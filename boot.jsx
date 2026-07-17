// ============================================================
// boot.jsx — PUBLIC loader & payment gate.
//
// This is the only app script served to unpaid visitors. The
// actual roadmap content (protected/*) is fetched from the
// server ONLY with a valid signed token, then injected & run.
// ============================================================

const TOKEN_KEY = "vibe-token";

const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch {} };
const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} };

const isLocalDev = () => {
  try {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  } catch { return false; }
};

// ---- backend calls -----------------------------------------------------
// The server owns the price. We fetch it purely to render it — the amount
// is never sent back, because the server would ignore it anyway.
let _config = null;
async function _getConfig() {
  if (_config) return _config;
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to fetch Razorpay config");
  const data = await res.json();
  if (!data.keyId) throw new Error("Backend returned empty Razorpay key id");
  if (!Number.isFinite(data.amountPaise)) throw new Error("Backend returned no price");
  _config = { keyId: data.keyId, amountPaise: data.amountPaise, upi: !!data.upi };
  return _config;
}
async function _createOrder(email) {
  const res = await fetch("/api/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to create order");
  return data;
}
async function _verifyPayment(payload) {
  const res = await fetch("/api/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok || !data.token) throw new Error(data?.error || "Verification failed");
  return data; // { ok, token, payment_id }
}
// Returns the session body on success, null on any failure. Callers treat it
// as a validity check, but the body also carries what this buyer paid.
async function _validateSession(token) {
  try {
    const res = await fetch("/api/session", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json(); // { ok, admin } | { ok, payment_id, amount_paise }
  } catch (e) {
    return null;
  }
}
async function _restore(paymentId) {
  const res = await fetch("/api/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_id: paymentId }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok || !data.token) throw new Error(data?.error || "Could not restore access");
  return data;
}

// ---- authenticated content loader --------------------------------------
// Fetch each protected file with the token, transform JSX, and execute it
// in the global scope (preserving the original multi-script load order).
const PROTECTED_FILES = ["data.js", "sections-v2.jsx", "sections-v3.jsx", "app.jsx", "mount.jsx"];

function _runInGlobalScope(code) {
  const el = document.createElement("script");
  el.textContent = code; // classic script → shares the global lexical scope
  document.head.appendChild(el);
}

async function loadRoadmap(token) {
  for (const name of PROTECTED_FILES) {
    const res = await fetch(`/api/content/${name}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Failed to load ${name} (${res.status})`);
    // Already compiled to plain JS server-side — just execute it.
    const code = await res.text();
    _runInGlobalScope(code);
  }
  if (typeof window.__renderRoadmap !== "function") {
    throw new Error("Roadmap bundle did not initialise");
  }
  window.__renderRoadmap();
}

// ============================================================
// UI
// ============================================================
function Spinner({ label }) {
  return (
    <div className="gate"><div className="gate-card" style={{ textAlign: "center" }}>
      <div className="kicker" style={{ color: "var(--orange)" }}>Loading</div>
      <h2 className="gate-title">{label || "Unlocking your roadmap…"}</h2>
    </div></div>
  );
}

function RestoreBox() {
  const [open, setOpen] = React.useState(false);
  const [pid, setPid] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  async function restore() {
    setErr(""); setBusy(true);
    try {
      const { token } = await _restore(pid.trim());
      setToken(token);
      window.location.reload();
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  if (!open) {
    return (
      <button className="gate-restore-link" onClick={() => setOpen(true)}>
        Already paid? Restore access →
      </button>
    );
  }
  return (
    <div className="gate-restore">
      <input
        className="gate-restore-input"
        placeholder="Your payment ID (pay_…)"
        aria-label="Your payment ID to restore access"
        value={pid}
        onChange={(e) => setPid(e.target.value)}
      />
      <button className="auth-btn" disabled={busy || !pid.trim()} onClick={restore}>
        {busy ? "Restoring…" : "Restore"}
      </button>
      {err && <div className="auth-err" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

// ============================================================
// Direct-UPI path — see Appendix A of the payments brief.
//
// Zero fee, and zero automation: the payer pays out of band and a
// human has to check the bank and approve. Only rendered when the
// server says UPI_VPA is configured.
// ============================================================
const QR_SRC = "https://unpkg.com/qrcode-generator@1.4.4/qrcode.js";
const QR_SRI = "sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k";
let _qrLoading = null;
function _loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (_qrLoading) return _qrLoading;
  _qrLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = QR_SRC;
    s.integrity = QR_SRI;
    s.crossOrigin = "anonymous";
    s.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error("QR library did not initialise")));
    s.onerror = () => reject(new Error("Could not load the QR library"));
    document.head.appendChild(s);
  });
  return _qrLoading;
}

// Phones can't scan the screen they're displaying. Show the QR on desktop,
// a tap-to-open deep link on mobile — the upi:// scheme opens the app directly.
const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent || "");

function UpiQr({ link }) {
  const ref = React.useRef(null);
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    let dead = false;
    _loadQr()
      .then((qrcode) => {
        if (dead || !ref.current) return;
        const qr = qrcode(0, "M");
        qr.addData(link);
        qr.make();
        ref.current.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
        const svg = ref.current.querySelector("svg");
        if (svg) { svg.style.width = "180px"; svg.style.height = "180px"; svg.style.background = "#fff"; }
      })
      .catch((e) => !dead && setErr(e.message));
    return () => { dead = true; };
  }, [link]);
  if (err) return <div className="auth-err" style={{ fontSize: 12 }}>{err} — use the UPI ID below instead.</div>;
  return <div ref={ref} style={{ display: "flex", justifyContent: "center", padding: 8 }} />;
}

function UpiPay({ price, onPaid, onCancel }) {
  const [order, setOrder] = React.useState(null);
  const [utr, setUtr] = React.useState("");
  const [stage, setStage] = React.useState("loading"); // loading | pay | claimed | error
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    let dead = false;
    fetch("/api/upi/create", { method: "POST" })
      .then((r) => r.json())
      .then((d) => { if (!dead) { setOrder(d); setStage("pay"); } })
      .catch(() => { if (!dead) { setErr("Couldn't start a UPI payment."); setStage("error"); } });
    return () => { dead = true; };
  }, []);

  // Once claimed, poll for a human to approve. Deliberately slow — nothing
  // here can confirm the payment, so we are waiting on a person.
  React.useEffect(() => {
    if (stage !== "claimed" || !order) return;
    let dead = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/upi/status/${order.ref}`);
        const d = await r.json();
        if (!dead && d.status === "captured" && d.token) {
          setToken(d.token);
          try { localStorage.setItem("vibe-payment-id", d.payment_id); } catch (e) {}
          onPaid(d.payment_id);
        }
      } catch (e) { /* keep polling quietly */ }
    };
    const id = setInterval(tick, 15000);
    tick();
    return () => { dead = true; clearInterval(id); };
  }, [stage, order]);

  async function submitClaim() {
    setErr("");
    try {
      const r = await fetch("/api/upi/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: order.ref, utr: utr.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d?.error || "Could not record that reference");
      setStage("claimed");
    } catch (e) { setErr(e.message); }
  }

  if (stage === "loading") return <p className="gate-sub">Preparing your UPI details…</p>;
  if (stage === "error") return <div className="auth-err">{err}</div>;

  if (stage === "claimed") {
    return (
      <div style={{ textAlign: "center" }}>
        <div className="kicker" style={{ color: "var(--orange)" }}>Payment reported</div>
        <h2 className="gate-title" style={{ fontSize: 20 }}>We're checking your payment.</h2>
        <p className="gate-sub">
          UPI payments are verified by hand, so this can take up to 24 hours. This page unlocks
          itself the moment it's approved — or come back later and use{" "}
          <strong>Restore access</strong> with the reference below.
        </p>
        <div className="mono" style={{ fontSize: 13, margin: "12px 0", userSelect: "all" }}>{order.ref}</div>
        <p className="gate-sub" style={{ fontSize: 12, opacity: 0.7 }}>Save that reference — it's your receipt.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="kicker" style={{ color: "var(--orange)" }}>Pay by UPI · no card needed</div>
      <h2 className="gate-title" style={{ fontSize: 20 }}>Send ₹{price} to unlock.</h2>

      {isMobile() ? (
        <a className="auth-btn gate-pay-btn" href={order.link} style={{ display: "block", textAlign: "center", marginTop: 12 }}>
          Open your UPI app →
        </a>
      ) : (
        <UpiQr link={order.link} />
      )}

      <div style={{ fontSize: 12, lineHeight: 1.7, marginTop: 12, opacity: 0.85 }}>
        <div>UPI ID: <strong className="mono" style={{ userSelect: "all" }}>{order.vpa}</strong></div>
        <div>Amount: <strong>₹{(order.amountPaise / 100).toFixed(2)}</strong></div>
        <div>Reference: <strong className="mono" style={{ userSelect: "all" }}>{order.ref}</strong></div>
      </div>

      <p className="gate-sub" style={{ fontSize: 12, marginTop: 14 }}>
        After paying, paste the UPI reference number (UTR) from your app. Access is granted once
        we've checked it — usually within 24 hours, not instantly.
      </p>
      <input
        className="gate-restore-input"
        placeholder="UPI reference / UTR"
        aria-label="UPI reference or UTR number from your payment app"
        value={utr}
        onChange={(e) => setUtr(e.target.value)}
        style={{ width: "100%", marginTop: 8 }}
      />
      <button className="auth-btn" style={{ width: "100%", marginTop: 8 }} disabled={!utr.trim()} onClick={submitClaim}>
        I've paid — submit reference
      </button>
      {err && <div className="auth-err" style={{ marginTop: 8 }}>{err}</div>}
      <button className="gate-restore-link" style={{ marginTop: 10 }} onClick={onCancel}>
        ← Back to instant payment
      </button>
    </div>
  );
}

// Razorpay cannot send a receipt to an address it was never given, and the
// receipt is the only durable copy of the payment id — localStorage dies with
// the cache. So the address is collected here rather than left to checkout.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function PaymentLanding({ onPaid }) {
  const [verifying, setVerifying] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [price, setPrice] = React.useState(null); // rupees, from the server
  const [upiAvailable, setUpiAvailable] = React.useState(false);
  const [upiMode, setUpiMode] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const emailOk = EMAIL_RE.test(email.trim());

  React.useEffect(() => {
    let cancelled = false;
    _getConfig()
      .then((c) => {
        if (cancelled) return;
        setPrice(c.amountPaise / 100);
        setUpiAvailable(!!c.upi);
      })
      .catch(() => { if (!cancelled) setErr("Couldn't load pricing — please refresh."); });
    return () => { cancelled = true; };
  }, []);

  async function pay() {
    setErr("");
    setTouched(true);
    if (!emailOk) {
      setErr("Enter a valid email — your receipt and payment ID are sent there.");
      return;
    }
    if (typeof Razorpay === "undefined") {
      setErr("Razorpay didn't load — check your network and refresh.");
      return;
    }
    setVerifying(true);
    try {
      const buyerEmail = email.trim();
      const { keyId } = await _getConfig();
      const order = await _createOrder(buyerEmail);
      const rzpConfig = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "Vibe Coding Roadmap",
        description: "Lifetime access · one-time payment",
        notes: { product: "vibe-coding-roadmap" },
        // Feeds Razorpay's own (undisableable) receipt email, and comes back
        // on the payment entity so it lands in the payments table.
        prefill: { email: buyerEmail },
        theme: { color: "#FF6B35" },
        // No display.blocks override. Razorpay's default checkout is
        // device-aware: UPI intent deep-links on mobile, QR + collect on
        // desktop. Pinning flows in a custom block defeats that detection
        // and strands mobile payers on a QR they cannot scan.
        handler: async function (response) {
          try {
            const data = await _verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setToken(data.token);
            try { localStorage.setItem("vibe-payment-id", data.payment_id); } catch (e) {}
            onPaid(data.payment_id);
          } catch (e) {
            console.error(e);
            setErr("Payment captured but verification failed. Use 'Restore access' with your payment ID, or contact support.");
            setVerifying(false);
          }
        },
        modal: { ondismiss: () => setVerifying(false) },
      };
      const rzp = new Razorpay(rzpConfig);
      rzp.on("payment.failed", (r) => {
        setErr("Payment failed: " + (r?.error?.description || "please try again"));
        setVerifying(false);
      });
      rzp.open();
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Couldn't start payment");
      setVerifying(false);
    }
  }

  // Until /api/config answers we don't know the price, so we don't claim one.
  const priceLabel = price == null ? "…" : `₹${price}`;

  return (
    <div className="landing">
      <div className="landing-left">
        <div className="landing-brand">
          <img className="landing-brand-mark" src="/assets/logo.png" alt="" width="72" height="70" />
          <div className="landing-brand-word">VCTP</div>
        </div>
        <div className="landing-meta"><span>Field Guide · v1.0</span><span>May 2026</span></div>
        <h1 className="landing-title">
          The Vibe Coding<br />Roadmap: from prompt<br />to <em>production-ready</em>.
        </h1>
        <p className="landing-sub">
          Every tool, framework, and service you need to take an idea from a 4&nbsp;PM Lovable prompt
          to a SOC&nbsp;2-audited product real customers pay for. <strong>One payment of {priceLabel}</strong> — lifetime access, no logins, no subscriptions.
        </p>
        <div className="landing-stats">
          <div className="stat"><div className="stat-val">15<span className="unit">sections</span></div><div className="stat-label">Field guide</div></div>
          <div className="stat"><div className="stat-val">8<span className="unit">stages</span></div><div className="stat-label">From idea to ship</div></div>
          <div className="stat"><div className="stat-val">27<span className="unit">items</span></div><div className="stat-label">Production checklist</div></div>
        </div>
      </div>
      <div className="landing-right">
        <div className="gate-card landing-gate-card">
          {upiMode ? (
            <UpiPay price={price} onPaid={onPaid} onCancel={() => setUpiMode(false)} />
          ) : (
          <React.Fragment>
          <div className="kicker" style={{ color: "var(--orange)" }}>One-time payment · Lifetime access</div>
          <h2 className="gate-title">Pay {priceLabel} once. Read forever.</h2>
          <p className="gate-sub">
            Single {priceLabel} payment unlocks the full roadmap <strong>permanently</strong> —
            no subscriptions, no second payment, no expiry.
          </p>
          <div className="gate-price">
            <div className="gate-price-val">{priceLabel}</div>
            <div className="gate-price-meta">
              <div className="gate-price-label">One-time</div>
              <div className="gate-price-note">Cards, UPI, wallets, netbanking</div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              className="gate-restore-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              aria-label="Email address for your receipt"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
            />
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6, lineHeight: 1.4 }}>
              {touched && !emailOk
                ? "Enter a valid email address."
                : "Your receipt and payment ID go here — it's how you restore access if you clear your browser."}
            </div>
          </div>
          <button onClick={pay} className="auth-btn gate-pay-btn" disabled={verifying || price == null || !emailOk}>
            {verifying ? "Waiting for payment…" : `Pay ${priceLabel} securely`}
          </button>
          <div className="gate-trust">
            <span>🔒 Verified by Razorpay</span><span>·</span><span>Server-side entitlement</span>
          </div>
          {err && <div className="auth-err" style={{ marginTop: 12 }}>{err}</div>}
          {upiAvailable && (
            <button
              className="gate-restore-link"
              style={{ display: "block", width: "100%", textAlign: "left", marginTop: 12 }}
              onClick={() => { setErr(""); setUpiMode(true); }}
            >
              Or pay by UPI — manual, up to 24h →
            </button>
          )}
          <RestoreBox />
          {isLocalDev() && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed rgba(255,255,255,0.15)" }}>
              <button
                className="gate-restore-link"
                style={{ color: "#ff6b35", fontSize: 12, opacity: 0.7 }}
                onClick={() => {
                  const secret = prompt("Enter admin secret:");
                  if (secret) {
                    setToken(secret);
                    window.location.reload();
                  }
                }}
              >
                🔧 Admin access (requires secret)
              </button>
            </div>
          )}
          </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentSuccess({ paymentId, onContinue }) {
  return (
    <div className="gate">
      <div className="gate-card gate-success">
        <div className="success-tick">✓</div>
        <div className="kicker" style={{ color: "var(--ok)" }}>Payment received · One-time</div>
        <h2 className="gate-title">You're in for life.</h2>
        <p className="gate-sub">
          One payment, lifetime access. The full Vibe Coding Roadmap is yours forever.
        </p>
        {paymentId && (
          <p className="gate-sub" style={{ fontSize: 13, opacity: 0.8 }}>
            Save your payment ID to restore access on another device:<br />
            <code style={{ userSelect: "all" }}>{paymentId}</code>
          </p>
        )}
        <button onClick={onContinue} className="auth-btn gate-pay-btn">View Roadmap →</button>
      </div>
    </div>
  );
}

// ---- gate controller ---------------------------------------------------
function Gate({ bootRoot }) {
  // ?reset=1 clears local access (handy for testing).
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.has("reset")) {
      clearToken();
      try { localStorage.removeItem("vibe-payment-id"); } catch {}
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  const [stage, setStage] = React.useState("checking"); // checking | pay | success | loading | error
  const [paymentId, setPaymentId] = React.useState("");
  const [err, setErr] = React.useState("");

  // Hand off from the boot React tree to the protected roadmap bundle.
  // `session` is the /api/session body when the caller already has it; the
  // post-payment path doesn't, so it is fetched rather than guessed at.
  async function enterRoadmap(session) {
    setStage("loading");
    try {
      const token = getToken();
      const s = session || (await _validateSession(token));
      // The protected bundle renders the access chip and has no other honest
      // source for the amount — hand it what this buyer actually paid.
      window.__vibeAccess = {
        admin: !!s?.admin,
        amountPaise: Number.isFinite(s?.amount_paise) ? s.amount_paise : null,
      };
      // Unmount this gate, then inject + render the roadmap into a clean #root.
      bootRoot.unmount();
      await loadRoadmap(token);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to load roadmap");
      // Re-mount the gate to show the error.
      ReactDOM.createRoot(document.getElementById("root")).render(<Gate bootRoot={bootRoot} />);
    }
  }

  React.useEffect(() => {
    let alive = true;
    (async () => {
      // --- Admin entry point ---
      const params = new URLSearchParams(window.location.search);
      const adminSecret = params.get("admin");
      if (adminSecret) {
        setToken(adminSecret);
        window.history.replaceState({}, "", window.location.pathname);
      }

      const token = getToken();
      if (token) {
        const session = await _validateSession(token);
        if (session && alive) enterRoadmap(session);
        else if (!session) {
          clearToken();
          if (alive) setStage("pay");
        }
      } else {
        clearToken();
        if (alive) setStage("pay");
      }
    })();
    return () => { alive = false; };
  }, []);

  if (stage === "checking") return <Spinner label="Checking access…" />;
  if (stage === "loading") return <Spinner label="Unlocking your roadmap…" />;
  if (stage === "error") {
    return (
      <div className="gate"><div className="gate-card" style={{ textAlign: "center" }}>
        <h2 className="gate-title">Something went wrong</h2>
        <p className="gate-sub">{err}</p>
        <button className="auth-btn gate-pay-btn" onClick={() => window.location.reload()}>Reload</button>
      </div></div>
    );
  }
  if (stage === "pay") {
    return <PaymentLanding onPaid={(pid) => { setPaymentId(pid); setStage("success"); }} />;
  }
  if (stage === "success") {
    // Wrapped, not passed by reference: onContinue hands its click event to the
    // first argument, which enterRoadmap would take for a session object.
    return <PaymentSuccess paymentId={paymentId} onContinue={() => enterRoadmap()} />;
  }
  return null;
}

// Boot.
const _rootEl = document.getElementById("root");
const _bootRoot = ReactDOM.createRoot(_rootEl);
_bootRoot.render(<Gate bootRoot={_bootRoot} />);
