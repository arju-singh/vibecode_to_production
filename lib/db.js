// ============================================================
// Persistence layer — payments are the source of truth.
// Uses Node's built-in SQLite (node:sqlite) — zero extra deps.
// ============================================================

const path = require("path");
const { DatabaseSync } = require("node:sqlite");

// DB file lives next to the app; override with DB_PATH in production
// (point it at a mounted volume so data survives container restarts).
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "app.db");

// Ensure the parent dir exists.
require("fs").mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    payment_id   TEXT PRIMARY KEY,
    order_id     TEXT,
    amount       INTEGER,          -- in paise
    currency     TEXT,
    status       TEXT,             -- created | captured | failed | refunded
    email        TEXT,
    contact      TEXT,
    source       TEXT,             -- 'verify' (browser) | 'webhook'
    raw          TEXT,             -- full JSON payload for auditing
    created_at   INTEGER NOT NULL, -- unix ms
    updated_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
  CREATE INDEX IF NOT EXISTS idx_payments_email ON payments(email);
`);

// Entitlement is decided by the writer (verify/webhook) at the moment the
// payment lands, by comparing the amount paid against the price in force
// *then*. It is stored rather than recomputed so that raising the price
// later never revokes access from someone who paid the old price in full.
const _cols = db.prepare("PRAGMA table_info(payments)").all().map((c) => c.name);
if (!_cols.includes("entitled")) {
  db.exec("ALTER TABLE payments ADD COLUMN entitled INTEGER NOT NULL DEFAULT 0");
  // Grandfather pre-migration buyers: anything captured at or above the
  // historical ₹50 launch price. Rows below that are underpayments from
  // before the server owned the price, and are deliberately not entitled.
  db.exec("UPDATE payments SET entitled = 1 WHERE status = 'captured' AND (amount IS NULL OR amount >= 5000)");
}

// Receipt send-state. Both /api/verify-payment (browser) and the webhook fire
// for the same successful payment, so "have we mailed this?" has to be durable
// and claimed atomically — otherwise every buyer gets two receipts.
if (!_cols.includes("receipt_sent_at")) {
  db.exec("ALTER TABLE payments ADD COLUMN receipt_sent_at INTEGER");
}

const _get = db.prepare("SELECT * FROM payments WHERE payment_id = ?");
const _insert = db.prepare(`
  INSERT INTO payments (payment_id, order_id, amount, currency, status, email, contact, source, raw, entitled, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(payment_id) DO UPDATE SET
    order_id   = COALESCE(excluded.order_id, payments.order_id),
    amount     = COALESCE(excluded.amount, payments.amount),
    currency   = COALESCE(excluded.currency, payments.currency),
    -- never downgrade a captured payment back to a lesser status
    status     = CASE WHEN payments.status = 'captured' THEN payments.status ELSE excluded.status END,
    email      = COALESCE(excluded.email, payments.email),
    contact    = COALESCE(excluded.contact, payments.contact),
    source     = excluded.source,
    raw        = COALESCE(excluded.raw, payments.raw),
    -- entitlement, once earned, is never revoked by a later write
    entitled   = MAX(payments.entitled, excluded.entitled),
    updated_at = excluded.updated_at
`);

function getPayment(paymentId) {
  return _get.get(paymentId);
}

// Insert or update a payment record. `now` is passed in so callers control time.
function upsertPayment(p, now) {
  _insert.run(
    p.payment_id,
    p.order_id || null,
    p.amount != null ? Number(p.amount) : null,
    p.currency || null,
    p.status || null,
    p.email || null,
    p.contact || null,
    p.source || "verify",
    p.raw ? JSON.stringify(p.raw) : null,
    p.entitled ? 1 : 0,
    now,
    now
  );
  return getPayment(p.payment_id);
}

// A payment grants access only once Razorpay has actually captured the money
// AND the amount cleared the price check performed when it was recorded.
// Both conditions matter: `captured` alone would honour any payment that
// reached this Razorpay account, including an underpayment or a payment for
// something else entirely.
function isPaid(paymentId) {
  const row = getPayment(paymentId);
  return !!row && row.status === "captured" && row.entitled === 1;
}

// Claim the right to send this payment's receipt. Returns true to exactly one
// caller: the UPDATE only matches while receipt_sent_at IS NULL, so whichever
// of verify/webhook arrives second gets false and stays quiet.
const _claimReceipt = db.prepare(
  "UPDATE payments SET receipt_sent_at = ? WHERE payment_id = ? AND receipt_sent_at IS NULL"
);
function claimReceiptSend(paymentId, now) {
  return _claimReceipt.run(now, paymentId).changes === 1;
}

// Hand the claim back if the send actually failed, so a later webhook retry
// can try again rather than the receipt being lost forever.
const _releaseReceipt = db.prepare(
  "UPDATE payments SET receipt_sent_at = NULL WHERE payment_id = ?"
);
function releaseReceiptSend(paymentId) {
  _releaseReceipt.run(paymentId);
}

module.exports = {
  db,
  getPayment,
  upsertPayment,
  isPaid,
  claimReceiptSend,
  releaseReceiptSend,
  DB_PATH,
};
