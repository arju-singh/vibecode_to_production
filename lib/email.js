// ============================================================
// Transactional receipt sender.
//
// Sends the one email this product needs: proof of payment carrying the
// payment id. Access is keyed to that id and nothing else — no accounts,
// no password — so this inbox is the buyer's only durable way back in
// once localStorage is cleared. That makes the receipt part of the
// product, not a courtesy.
//
// Resend over HTTPS: Node 22 ships global fetch, so this costs zero
// dependencies (same reasoning as node:sqlite in db.js).
//
// Disabled unless RESEND_API_KEY and MAIL_FROM are both set — mirroring
// the UPI_VPA switch in server.js. Off is a valid, quiet state: Razorpay
// sends its own receipt regardless, so a missing key degrades the buyer's
// experience without breaking it.
// ============================================================

const fs = require("fs");
const path = require("path");

const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const MAIL_FROM = (process.env.MAIL_FROM || "").trim();
const MAIL_REPLY_TO = (process.env.MAIL_REPLY_TO || "").trim();
const SITE_URL = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");

const MAIL_ENABLED = (() => {
  if (!RESEND_API_KEY || !MAIL_FROM) return false;
  // "Name <a@b.com>" or bare "a@b.com" — a malformed From is rejected by the
  // API at send time, which would only surface after a real customer paid.
  if (!/^(.*<\s*[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}\s*>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,})$/.test(MAIL_FROM)) {
    console.error(`Invalid MAIL_FROM (${MAIL_FROM}) — expected "Name <you@domain.com>". Receipt email disabled.`);
    return false;
  }
  if (!SITE_URL) {
    console.error("MAIL_FROM is set but SITE_URL is not — receipt links would be dead. Receipt email disabled.");
    return false;
  }
  return true;
})();

const TEMPLATE_PATH = path.join(__dirname, "emails", "receipt.html");

// Read once at boot: a template that fails to load should be loud at startup,
// not at the moment someone pays.
const TEMPLATE = (() => {
  if (!MAIL_ENABLED) return null;
  try {
    return fs.readFileSync(TEMPLATE_PATH, "utf8");
  } catch (e) {
    console.error(`Could not read ${TEMPLATE_PATH}: ${e.message}. Receipt email disabled.`);
    return null;
  }
})();

// Values land inside HTML. `email` is buyer-supplied, so escaping is not
// optional — an address containing markup would otherwise be injected into
// the mail body verbatim.
function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? esc(vars[key]) : ""
  );
}

function formatAmount(paise) {
  const n = Number(paise);
  if (!Number.isFinite(n)) return "";
  // Whole rupees read as "499"; anything with paise keeps both decimals.
  return n % 100 === 0 ? String(n / 100) : (n / 100).toFixed(2);
}

function formatDate(ms) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(ms)) + " IST";
  } catch {
    return new Date(ms).toISOString();
  }
}

// Plain-text alternative. Some clients show it, spam filters like seeing it,
// and it keeps the payment id readable if the HTML is stripped entirely.
function textBody({ paymentId, amount, orderId, paidAt, email }) {
  return [
    "Payment received — you're in for life.",
    "",
    `Your payment ID: ${paymentId}`,
    "",
    "Keep this email. There are no accounts and no password — if you clear",
    "your browser or switch device, this ID is how you get back in:",
    `  1. Go to ${SITE_URL} and click "Already paid? Restore access"`,
    "  2. Paste the payment ID above",
    "  3. You're back in, on any device.",
    "",
    "Receipt",
    `  Item:      The Vibe Coding Roadmap — lifetime access`,
    `  Amount:    ₹${amount}`,
    `  Date:      ${paidAt}`,
    `  Order ID:  ${orderId}`,
    `  Billed to: ${email}`,
    "",
    `Questions? Just reply to this email.`,
    "",
    `${SITE_URL}/terms · ${SITE_URL}/refund · ${SITE_URL}/privacy`,
  ].join("\n");
}

// Sends the receipt. Resolves { ok, skipped?, error? } and NEVER throws:
// callers invoke this after entitlement is already granted, and a mail
// outage must not cost a paying customer their access.
async function sendReceipt({ paymentId, orderId, amountPaise, email, paidAtMs }) {
  if (!MAIL_ENABLED || !TEMPLATE) return { ok: false, skipped: "disabled" };
  if (!email) return { ok: false, skipped: "no-email" };

  const vars = {
    payment_id: paymentId,
    order_id: orderId || "—",
    amount: formatAmount(amountPaise),
    email,
    paid_at: formatDate(paidAtMs || Date.now()),
    site_url: SITE_URL,
  };

  const payload = {
    from: MAIL_FROM,
    to: [email],
    subject: `Your Vibe Coding Roadmap access — payment ID ${paymentId}`,
    html: render(TEMPLATE, vars),
    text: textBody({
      paymentId,
      amount: vars.amount,
      orderId: vars.order_id,
      paidAt: vars.paid_at,
      email,
    }),
    ...(MAIL_REPLY_TO ? { reply_to: MAIL_REPLY_TO } : {}),
  };

  try {
    // Don't hang a request thread on a slow provider.
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 300)}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e?.message || "send failed" };
  }
}

module.exports = { sendReceipt, MAIL_ENABLED };
