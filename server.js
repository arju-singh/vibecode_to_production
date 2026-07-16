// ============================================================
// Vibe Coding Roadmap — Express server
// Static site + Razorpay checkout + server-side entitlement.
//
// The paid content (protected/*) is NOT served as flat static.
// It is delivered only to clients holding a valid signed token,
// which is minted only after a payment is verified/captured.
// ============================================================

require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");

const { db, upsertPayment, getPayment, isPaid, claimReceiptSend, releaseReceiptSend } = require("./lib/db");
const { issueToken, verifyToken } = require("./lib/tokens");
const { sendReceipt, MAIL_ENABLED } = require("./lib/email");

const PORT = Number(process.env.PORT) || 3333;
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";
const ADMIN_SECRET = (() => {
  const raw = process.env.ADMIN_SECRET || "";
  if (!raw) return "";
  if (raw.length < 32) {
    console.warn("WARNING: ADMIN_SECRET is too short (<32 chars). Admin bypass disabled.");
    return "";
  }
  return raw;
})();
const IS_PROD = process.env.NODE_ENV === "production";

// ------------------------------------------------------------
// Price is owned by the server, never by the client. The browser
// is told what the price is (for rendering); it does not get to
// say what it will pay. Change the price here / in .env only —
// PRICE_PAISE is the single source of truth.
// ------------------------------------------------------------
const PRICE_PAISE = (() => {
  const raw = Number(process.env.PRICE_PAISE || 5000);
  if (!Number.isInteger(raw) || raw < 100) {
    console.error(`Invalid PRICE_PAISE (${process.env.PRICE_PAISE}) — must be an integer >= 100 paise (₹1).`);
    process.exit(1);
  }
  return raw;
})();
const PRODUCT_ID = "vibe-coding-roadmap";

// ------------------------------------------------------------
// Direct-UPI path (Appendix A of the payments brief).
//
// This is the "no gateway, no fee, no automation" route: the payer
// is handed a upi:// deep link, pays out of band, and NOTHING tells
// this server it happened. Entitlement is therefore granted by a
// HUMAN via the admin endpoints below — never automatically.
//
// Disabled unless UPI_VPA is set. Leave it unset and this entire
// path does not exist: /api/config reports upi:false and the
// endpoints 404. That is the intended default.
// ------------------------------------------------------------
const UPI_VPA = (process.env.UPI_VPA || "").trim();
const UPI_PAYEE_NAME = (process.env.UPI_PAYEE_NAME || "Vibe Coding Roadmap").trim();
const UPI_ENABLED = (() => {
  if (!UPI_VPA) return false;
  // A VPA is name@handle. Reject anything that plainly isn't one rather
  // than generating a deep link that silently fails in the payer's app.
  if (!/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(UPI_VPA)) {
    console.error(`Invalid UPI_VPA (${UPI_VPA}) — expected the form name@bank. Direct-UPI path disabled.`);
    return false;
  }
  if (!ADMIN_SECRET) {
    console.error("UPI_VPA is set but ADMIN_SECRET is not — nobody could approve payments. Direct-UPI path disabled.");
    return false;
  }
  return true;
})();

// Build a upi://pay deep link per the NPCI UPI Linking Specification.
// Omitting `mam` means the amount is NOT editable in the payer's app.
function buildUpiLink(ref) {
  const params = new URLSearchParams({
    pa: UPI_VPA,
    pn: UPI_PAYEE_NAME,
    am: (PRICE_PAISE / 100).toFixed(2),
    cu: "INR",
    tr: ref,
    tn: `${PRODUCT_ID} ${ref}`,
  });
  // URLSearchParams encodes spaces as '+', which some UPI apps mishandle.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

// Mail the receipt exactly once per payment, whichever of verify/webhook gets
// there first. Deliberately not awaited by request handlers: entitlement is
// already granted by this point, so a slow or broken mail provider must not
// delay the buyer's unlock or turn a successful payment into an error.
function mailReceiptOnce(row, now) {
  if (!MAIL_ENABLED || !row?.email) return;
  if (!claimReceiptSend(row.payment_id, now)) return; // someone else has it
  sendReceipt({
    paymentId: row.payment_id,
    orderId: row.order_id,
    amountPaise: row.amount,
    email: row.email,
    paidAtMs: now,
  })
    .then((r) => {
      if (r.ok) {
        console.log(`[mail] receipt sent for ${row.payment_id}`);
      } else if (r.skipped) {
        console.warn(`[mail] receipt skipped for ${row.payment_id}: ${r.skipped}`);
        releaseReceiptSend(row.payment_id);
      } else {
        console.error(`[mail] receipt FAILED for ${row.payment_id}: ${r.error}`);
        releaseReceiptSend(row.payment_id); // let a webhook retry pick it up
      }
    })
    .catch((e) => {
      console.error(`[mail] receipt threw for ${row.payment_id}: ${e?.message}`);
      releaseReceiptSend(row.payment_id);
    });
}

function isAdminSecret(value) {
  const secret = Buffer.from(ADMIN_SECRET, "utf8");
  const input = Buffer.from(String(value), "utf8");
  if (secret.length !== input.length) return false;
  return crypto.timingSafeEqual(secret, input);
}

if (!KEY_ID || !KEY_SECRET) {
  console.error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env");
  process.exit(1);
}

const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
const PROTECTED_DIR = path.join(__dirname, "protected");

// Files the authenticated content loader is allowed to fetch, in load order.
const PROTECTED_FILES = ["data.js", "sections-v2.jsx", "sections-v3.jsx", "app.jsx", "mount.jsx"];

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // real client IP behind a proxy/load balancer

// ------------------------------------------------------------
// CORS — locked to configured origins. Same-origin browser
// requests don't need CORS; this only matters if you embed the
// API elsewhere. Set ALLOWED_ORIGINS=https://a.com,https://b.com
// ------------------------------------------------------------
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Browsers omit Origin only on same-origin GET/HEAD; a same-origin POST still
// carries it. So the Origin has to be compared against the host actually
// serving the request — otherwise this site's own checkout POST is rejected
// whenever ALLOWED_ORIGINS is set to the production domains.
function originAllowed(origin, host) {
  if (!origin) return true; // non-browser client (curl, Razorpay webhook)
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false; // unparseable Origin
  }
  if (originHost === host) return true; // same-origin, any port
  if (ALLOWED_ORIGINS.length === 0) return true; // unset = same-origin only, already covered
  return ALLOWED_ORIGINS.includes(origin);
}

app.use(
  cors((req, cb) => {
    if (originAllowed(req.headers.origin, req.headers.host)) return cb(null, { origin: true });
    const err = new Error("Origin not allowed");
    err.status = 403;
    cb(err);
  })
);

// ------------------------------------------------------------
// Razorpay webhook — MUST read the raw body to verify the
// signature, so it is mounted BEFORE express.json().
// ------------------------------------------------------------
app.post("/api/webhook/razorpay", express.raw({ type: "*/*" }), (req, res) => {
  if (!WEBHOOK_SECRET) {
    console.error("[webhook] received but RAZORPAY_WEBHOOK_SECRET is not configured");
    return res.status(503).json({ error: "Webhook not configured" });
  }
  const signature = req.headers["x-razorpay-signature"];
  const raw = req.body; // Buffer
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
  const a = Buffer.from(String(signature || ""), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.warn("[webhook] signature mismatch — ignoring");
    return res.status(400).json({ error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Bad JSON" });
  }

  const now = Date.now();
  const entity = event?.payload?.payment?.entity;
  if (entity) {
    // This account's webhook fires for every payment it receives, not just
    // ones that came through this site's checkout. Entitlement therefore has
    // to be earned here too — full price, for this product — or a payment
    // for anything else would become a valid access token via /api/restore.
    const entitled =
      entity.status === "captured" &&
      Number.isFinite(entity.amount) &&
      entity.amount >= PRICE_PAISE &&
      entity.notes?.product === PRODUCT_ID;

    const row = upsertPayment(
      {
        payment_id: entity.id,
        order_id: entity.order_id,
        amount: entity.amount,
        currency: entity.currency,
        status: entity.status, // 'captured' on payment.captured
        email: entity.email || entity.notes?.email || null,
        contact: entity.contact,
        source: "webhook",
        raw: entity,
        entitled,
      },
      now
    );
    console.log(`[webhook] ${event.event} recorded for ${entity.id} (${entity.status}, entitled=${entitled})`);
    // Only mail once the money is genuinely earned — never for an unentitled
    // payment. This is the path that matters: it fires even if the buyer
    // closed the tab before /api/verify-payment ran.
    if (entitled) mailReceiptOnce(row, now);
  }
  // Always 200 quickly so Razorpay doesn't retry on our processing time.
  res.json({ ok: true });
});

// JSON body parser for the rest of the API.
app.use(express.json());

// In-memory rate limiter (swap for Redis in a multi-instance deploy).
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of hits) if (rec.resetAt <= now) hits.delete(ip);
  }, windowMs).unref?.();
  return (req, res, next) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    let rec = hits.get(ip);
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs };
      hits.set(ip, rec);
    }
    rec.count += 1;
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - rec.count));
    res.setHeader("RateLimit-Reset", Math.ceil((rec.resetAt - now) / 1000));
    if (rec.count > max) {
      res.setHeader("Retry-After", Math.ceil((rec.resetAt - now) / 1000));
      return res.status(429).json({ error: message || "Too many requests." });
    }
    next();
  };
}
app.use("/api/", rateLimit({ windowMs: 60 * 1000, max: 30, message: "Too many requests — wait a minute." }));

// ------------------------------------------------------------
// Auth middleware — extracts a valid token from the request.
// Accepts  Authorization: Bearer <token>  or  ?token=<token>.
// ------------------------------------------------------------
function requireToken(req, res, next) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const credential = bearer || req.query.token;

  // --- Admin bypass ---
  if (ADMIN_SECRET && credential && isAdminSecret(credential)) {
    req.claims = { admin: true };
    console.info(`[admin] content accessed: ${req.path}`);
    return next();
  }

  // --- Normal token flow ---
  const claims = verifyToken(credential);
  if (!claims) return res.status(401).json({ ok: false, error: "Not authorized" });
  // Defence in depth: the payment the token was minted for must still be captured.
  if (!isPaid(claims.pid)) return res.status(403).json({ ok: false, error: "Access revoked" });
  req.claims = claims;
  next();
}

// Health check for load balancers / uptime monitors.
app.get("/healthz", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Public config — only the KEY_ID (never the SECRET).
app.get("/api/config", (_req, res) =>
  res.json({ keyId: KEY_ID, amountPaise: PRICE_PAISE, upi: UPI_ENABLED })
);

// ------------------------------------------------------------
// Direct-UPI endpoints. All of them 404 unless UPI_ENABLED.
//
// The lifecycle is deliberately slow and human-gated:
//   create  -> 'pending'   (payer has a link, nothing has happened)
//   claim   -> 'claimed'   (payer says they paid, with a UTR)
//   approve -> 'captured' + entitled=1   (YOU verified it in your bank)
//
// Only `approve` grants access, and only an admin can call it. There
// is no code path here that turns an unverified claim into a token —
// that is the whole point, and the reason this route costs time.
// ------------------------------------------------------------
function requireUpiEnabled(_req, res, next) {
  if (!UPI_ENABLED) return res.status(404).json({ error: "Not found" });
  next();
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const credential = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!ADMIN_SECRET || !credential || !isAdminSecret(credential)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Payer asks for a link. Creates a pending, unentitled record.
app.post("/api/upi/create", requireUpiEnabled, (_req, res) => {
  const ref = `upi_${crypto.randomBytes(6).toString("hex")}`;
  const now = Date.now();
  upsertPayment(
    {
      payment_id: ref,
      amount: PRICE_PAISE,
      currency: "INR",
      status: "pending",
      source: "upi",
      entitled: false, // only an admin approval can change this
    },
    now
  );
  res.json({ ref, link: buildUpiLink(ref), amountPaise: PRICE_PAISE, vpa: UPI_VPA, payee: UPI_PAYEE_NAME });
});

// Payer reports the UTR after paying. This is a CLAIM, not proof.
app.post("/api/upi/claim", requireUpiEnabled, (req, res) => {
  const ref = String(req.body?.ref || "").trim();
  const utr = String(req.body?.utr || "").trim();
  if (!/^upi_[a-f0-9]{12}$/.test(ref)) return res.status(400).json({ ok: false, error: "Invalid reference" });
  if (!/^[a-zA-Z0-9]{6,25}$/.test(utr)) {
    return res.status(400).json({ ok: false, error: "Enter the UPI reference / UTR from your payment app." });
  }
  const row = getPayment(ref);
  if (!row || row.source !== "upi") return res.status(404).json({ ok: false, error: "Unknown reference" });
  if (row.status === "captured") return res.json({ ok: true, status: "captured" });

  const now = Date.now();
  upsertPayment(
    {
      payment_id: ref,
      status: "claimed",
      source: "upi",
      entitled: false,
      // The UTR is an unverified assertion by the payer, so it lives in the
      // audit blob rather than anywhere a query might mistake it for proof.
      raw: { utr, claimed_at: now, note: "payer-asserted, unverified" },
    },
    now
  );
  console.log(`[upi] claim recorded: ${ref} utr=${utr} — awaiting manual approval`);
  res.json({ ok: true, status: "claimed" });
});

// Payer polls this. Returns a token ONLY once an admin has approved.
app.get("/api/upi/status/:ref", requireUpiEnabled, (req, res) => {
  const ref = String(req.params.ref || "");
  if (!/^upi_[a-f0-9]{12}$/.test(ref)) return res.status(400).json({ error: "Invalid reference" });
  const row = getPayment(ref);
  if (!row || row.source !== "upi") return res.status(404).json({ error: "Unknown reference" });
  if (isPaid(ref)) return res.json({ status: "captured", token: issueToken(ref), payment_id: ref });
  res.json({ status: row.status });
});

// --- Admin: review and approve. This is the manual work the fee buys away. ---
app.get("/api/admin/upi", requireUpiEnabled, requireAdmin, (_req, res) => {
  const rows = db
    .prepare("SELECT payment_id, amount, status, entitled, raw, created_at, updated_at FROM payments WHERE source = 'upi' ORDER BY created_at DESC LIMIT 100")
    .all();
  const out = rows.map((r) => {
    let utr = null;
    try { utr = r.raw ? JSON.parse(r.raw).utr || null : null; } catch {}
    return {
      ref: r.payment_id,
      amount: r.amount,
      status: r.status,
      entitled: r.entitled === 1,
      utr,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
  res.json({ ok: true, count: out.length, awaiting: out.filter((r) => r.status === "claimed").length, rows: out });
});

app.post("/api/admin/upi/approve", requireUpiEnabled, requireAdmin, (req, res) => {
  const ref = String(req.body?.ref || "").trim();
  if (!/^upi_[a-f0-9]{12}$/.test(ref)) return res.status(400).json({ ok: false, error: "Invalid reference" });
  const row = getPayment(ref);
  if (!row || row.source !== "upi") return res.status(404).json({ ok: false, error: "Unknown reference" });

  upsertPayment(
    { payment_id: ref, status: "captured", source: "upi", entitled: true },
    Date.now()
  );
  console.log(`[upi] APPROVED by admin: ${ref} (${row.contact || "no utr"}) — access granted`);
  res.json({ ok: true, ref, status: "captured" });
});

app.post("/api/admin/upi/reject", requireUpiEnabled, requireAdmin, (req, res) => {
  const ref = String(req.body?.ref || "").trim();
  if (!/^upi_[a-f0-9]{12}$/.test(ref)) return res.status(400).json({ ok: false, error: "Invalid reference" });
  const row = getPayment(ref);
  if (!row || row.source !== "upi") return res.status(404).json({ ok: false, error: "Unknown reference" });
  if (row.status === "captured") {
    return res.status(409).json({ ok: false, error: "Already approved — entitlement is not revoked here." });
  }
  upsertPayment({ payment_id: ref, status: "failed", source: "upi", entitled: false }, Date.now());
  console.log(`[upi] rejected by admin: ${ref}`);
  res.json({ ok: true, ref, status: "failed" });
});

// Validate an existing token (front-end calls this on load to decide the gate).
// Also reports what this buyer paid, so the access chip can render a receipt
// rather than a guess. The amount comes from their payment row and NOT from
// PRICE_PAISE: raising the price must never rewrite the receipt of someone who
// bought at the old one — the same reasoning that made `entitled` a stored
// column rather than a recomputed one.
app.get("/api/session", requireToken, (req, res) => {
  if (req.claims.admin) return res.json({ ok: true, admin: true });
  const row = getPayment(req.claims.pid);
  res.json({
    ok: true,
    payment_id: req.claims.pid,
    // null for grandfathered rows that predate the amount column.
    amount_paise: Number.isFinite(row?.amount) ? row.amount : null,
  });
});

// Create a Razorpay order for the one fixed price this site sells at.
// The client's amount is deliberately ignored: an amount supplied by the
// client would let anyone mint a ₹1 order and unlock the whole product.
// `email` is the ONLY field read from the body — it is not a price and
// carries no entitlement; it exists so Razorpay can send the receipt that
// carries the payment id, which is the buyer's only route back in.
app.post("/api/create-order", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: "A valid email is required for your receipt." });
    }
    const order = await razorpay.orders.create({
      amount: PRICE_PAISE,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      // Mirrored into notes so the address survives even if the payment
      // entity comes back without one.
      notes: { product: PRODUCT_ID, email },
    });
    res.json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (e) {
    console.error("[create-order]", e);
    const status = e?.statusCode === 401 ? 401 : 500;
    res.status(status).json({ error: e?.error?.description || e?.message || "Order creation failed" });
  }
});

// Verify Razorpay signature → record payment → mint access token.
app.post("/api/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }
    const expected = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(razorpay_signature, "utf8");
    const sigMatch = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!sigMatch) {
      return res.status(400).json({ ok: false, error: "Signature mismatch" });
    }

    // The signature only proves this payment belongs to that order — it says
    // nothing about how much was paid. Pull the authoritative amount from
    // Razorpay. This is a hard dependency: without it we cannot know whether
    // the price was met, and guessing in the customer's favour is what let a
    // ₹1 payment unlock the product.
    let details = null;
    try {
      details = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (e) {
      console.error("[verify-payment] could not fetch payment details:", e?.message);
      return res.status(502).json({ ok: false, error: "Could not confirm payment with Razorpay. Please try 'Restore access' in a moment." });
    }

    if (!Number.isFinite(details.amount) || details.amount < PRICE_PAISE) {
      console.warn(`[verify-payment] underpayment: ${razorpay_payment_id} paid ${details.amount} < ${PRICE_PAISE}`);
      return res.status(400).json({ ok: false, error: "Payment amount does not match the price." });
    }
    if (details.order_id !== razorpay_order_id) {
      console.warn(`[verify-payment] order mismatch on ${razorpay_payment_id}`);
      return res.status(400).json({ ok: false, error: "Payment does not belong to that order." });
    }

    const now = Date.now();
    // Only a genuine 'captured' earns entitlement. 'authorized' means the
    // funds are held, NOT taken — a capture that later fails or is voided
    // would otherwise have bought permanent access to unpaid content.
    // Record it as pending-and-unentitled and let the payment.captured
    // webhook flip it; the payer retries via /api/restore a moment later.
    if (details.status === "authorized") {
      upsertPayment(
        {
          payment_id: razorpay_payment_id,
          order_id: razorpay_order_id,
          amount: details.amount,
          currency: details.currency,
          status: "authorized",
          email: details.email,
          contact: details.contact,
          source: "verify",
          raw: details,
          entitled: false, // not captured yet — no access
        },
        now
      );
      console.warn(`[verify-payment] authorized but not captured: ${razorpay_payment_id}`);
      return res.status(409).json({
        ok: false,
        pending: true,
        payment_id: razorpay_payment_id,
        error: "Payment is still being confirmed. Give it a moment, then use 'Restore access' with your payment ID.",
      });
    }
    const status = details.status;
    if (status !== "captured") {
      return res.status(400).json({ ok: false, error: `Payment is not captured (status: ${details.status}).` });
    }

    const row = upsertPayment(
      {
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        amount: details.amount,
        currency: details.currency,
        status,
        email: details.email || details.notes?.email || null,
        contact: details.contact,
        source: "verify",
        raw: details,
        entitled: true, // amount cleared PRICE_PAISE above
      },
      now
    );
    mailReceiptOnce(row, now);

    const token = issueToken(razorpay_payment_id, { now });
    res.json({ ok: true, token, payment_id: razorpay_payment_id });
  } catch (e) {
    console.error("[verify-payment]", e);
    res.status(500).json({ ok: false, error: e?.message || "Verification failed" });
  }
});

// Restore access on a new device/browser using a known payment id.
// (No accounts by design — this is the "I paid, let me back in" path.)
app.post("/api/restore", (req, res) => {
  const paymentId = String(req.body?.payment_id || "").trim();
  if (!paymentId) return res.status(400).json({ ok: false, error: "payment_id required" });
  if (!isPaid(paymentId)) {
    return res.status(404).json({ ok: false, error: "No captured payment found for that ID." });
  }
  res.json({ ok: true, token: issueToken(paymentId), payment_id: paymentId });
});

// Gated content — the actual paid roadmap. Served only with a valid token.
app.get("/api/content/:name", requireToken, (req, res) => {
  const name = req.params.name;
  if (!PROTECTED_FILES.includes(name)) return res.status(404).json({ error: "Unknown resource" });
  res.setHeader("Cache-Control", "no-store");
  res.type("text/plain"); // delivered as text; the client transforms/executes it
  res.sendFile(path.join(PROTECTED_DIR, name));
});

// ------------------------------------------------------------
// Public static assets (everything that is NOT paid content):
// the HTML shell, styles, boot loader, legal pages, images.
// Block anything sensitive that lives under the app root so the
// static handler can't leak it (protected content, server code,
// secrets, the DB, backups).
// ------------------------------------------------------------
const DENY_PREFIXES = ["/protected", "/lib", "/data", "/node_modules", "/reference"];
const DENY_FILES = new Set([
  "/server.js", "/.env", "/.env.example", "/package.json", "/package-lock.json",
]);
app.use((req, res, next) => {
  const p = decodeURIComponent(req.path);
  if (DENY_PREFIXES.some((d) => p === d || p.startsWith(d + "/")) || DENY_FILES.has(p)) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(__dirname, { index: false, dotfiles: "deny" }));

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "Vibe Coding Roadmap.html")));
app.get("/privacy", (_req, res) => res.sendFile(path.join(__dirname, "privacy.html")));
app.get("/terms", (_req, res) => res.sendFile(path.join(__dirname, "terms.html")));
app.get("/refund", (_req, res) => res.sendFile(path.join(__dirname, "refund.html")));

// Last resort error handler. Must be registered after every route, and must
// keep 4 args or Express treats it as ordinary middleware. Without it, a throw
// anywhere above returns Express's HTML error page, which the frontend then
// tries to parse as JSON ("Unexpected token '<'") — hiding the real cause.
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error("[error]", err);
  // Don't leak internals on a 500; deliberate 4xx messages are safe to send.
  res.status(status).json({ error: status >= 500 ? "Internal error" : err.message });
});

app.listen(PORT, () => {
  console.log(`Vibe Coding Roadmap server listening on http://localhost:${PORT}`);
  console.log(`Razorpay mode: ${KEY_ID.startsWith("rzp_live_") ? "LIVE" : "TEST"}`);
  console.log(`Env: ${IS_PROD ? "production" : "development"}`);
  console.log(`Webhook: ${WEBHOOK_SECRET ? "configured" : "NOT configured"}`);
});
