// ============================================================
// Persistence layer — payments are the source of truth.
// Firestore (via firebase-admin). One doc per payment, keyed by payment_id.
//
// Every function here is async: Firestore has no synchronous API, unlike the
// node:sqlite layer this replaces. Callers must await.
//
// The guarantees the SQL schema gave us are preserved, but they are no longer
// free — each one is re-implemented explicitly:
//   * upsert field merging (was COALESCE)          -> readback + per-field merge
//   * never downgrade a captured payment (was CASE) -> guarded in a transaction
//   * entitlement is never revoked (was MAX)        -> guarded in a transaction
//   * exactly-one receipt sender (was a conditional -> compare-and-set inside a
//     UPDATE ... WHERE ... IS NULL)                    transaction
// The transactions are what make concurrent verify/webhook writes for the same
// payment safe; a plain read-then-write would let one clobber the other.
// ============================================================

// firebase-admin v14 exposes only the modular API from these subpaths. The old
// namespaced form (`require("firebase-admin").apps` / `.firestore()`) is gone —
// it throws at require-time, before the server can serve a single request.
const { initializeApp, getApps, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Guarded so repeated requires (or a test importing this twice) don't throw on
// duplicate app initialisation.
// On Cloud Run the credentials and project are both ambient; locally they come
// from `gcloud auth application-default login` + GOOGLE_CLOUD_PROJECT.
const app =
  getApps()[0] ||
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
  });

const firestore = getFirestore(app);
firestore.settings({ ignoreUndefinedProperties: true });

const COLLECTION = process.env.FIRESTORE_COLLECTION || "payments";
const payments = firestore.collection(COLLECTION);

// Historical launch price in paise. Anything captured at or above this is
// entitled; below it is an underpayment from before the server owned the price.
// Mirrors the grandfathering clause in the old SQLite migration.
const LEGACY_PRICE_FLOOR_PAISE = 5000;

// Firestore stores no schema, so normalise on read to the exact shape the old
// SELECT * returned. Call sites compare `entitled === 1` and JSON.parse(raw),
// so those types are kept as-is rather than modernised to boolean/object.
function toRow(snap) {
  if (!snap || !snap.exists) return undefined;
  const d = snap.data();
  return {
    payment_id: snap.id,
    order_id: d.order_id ?? null,
    amount: d.amount ?? null,
    currency: d.currency ?? null,
    status: d.status ?? null,
    email: d.email ?? null,
    contact: d.contact ?? null,
    source: d.source ?? null,
    raw: d.raw ?? null,
    entitled: d.entitled === 1 || d.entitled === true ? 1 : 0,
    receipt_sent_at: d.receipt_sent_at ?? null,
    created_at: d.created_at ?? null,
    updated_at: d.updated_at ?? null,
  };
}

async function getPayment(paymentId) {
  return toRow(await payments.doc(String(paymentId)).get());
}

// Insert or update a payment record. `now` is passed in so callers control time.
// Runs in a transaction: verify (browser) and the webhook routinely land on the
// same payment at the same moment, and the merge rules below are only correct
// if the read and the write see the same state.
async function upsertPayment(p, now) {
  const ref = payments.doc(String(p.payment_id));

  await firestore.runTransaction(async (tx) => {
    const prev = toRow(await tx.get(ref));

    const incoming = {
      order_id: p.order_id ?? null,
      amount: p.amount != null ? Number(p.amount) : null,
      currency: p.currency ?? null,
      email: p.email ?? null,
      contact: p.contact ?? null,
      raw: p.raw ? JSON.stringify(p.raw) : null,
    };

    // COALESCE(excluded.x, payments.x) — a null in the incoming write must not
    // erase a value we already hold. The webhook and verify each carry
    // different subsets of the fields, so this is load-bearing, not defensive.
    const merged = {};
    for (const [k, v] of Object.entries(incoming)) {
      merged[k] = v != null ? v : prev?.[k] ?? null;
    }

    // Never downgrade a captured payment back to a lesser status. A late
    // 'failed'/'created' event must not un-sell something already paid for.
    merged.status =
      prev?.status === "captured" ? "captured" : p.status ?? prev?.status ?? null;

    // Entitlement, once earned, is never revoked by a later write.
    merged.entitled = Math.max(prev?.entitled ?? 0, p.entitled ? 1 : 0);

    // `source` always reflects the most recent writer (matches excluded.source).
    merged.source = p.source || "verify";

    merged.updated_at = now;
    merged.created_at = prev?.created_at ?? now;
    // Preserve any existing receipt claim — upsert must never hand out a
    // second receipt by clearing this field.
    merged.receipt_sent_at = prev?.receipt_sent_at ?? null;

    tx.set(ref, merged);
  });

  return getPayment(p.payment_id);
}

// A payment grants access only once Razorpay has actually captured the money
// AND the amount cleared the price check performed when it was recorded.
// Both conditions matter: `captured` alone would honour any payment that
// reached this Razorpay account, including an underpayment or a payment for
// something else entirely.
async function isPaid(paymentId) {
  const row = await getPayment(paymentId);
  return !!row && row.status === "captured" && row.entitled === 1;
}

// Claim the right to send this payment's receipt. Returns true to exactly one
// caller: the transaction only sets receipt_sent_at while it is still null, so
// whichever of verify/webhook arrives second gets false and stays quiet.
async function claimReceiptSend(paymentId, now) {
  const ref = payments.doc(String(paymentId));
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    if (snap.data().receipt_sent_at != null) return false;
    tx.update(ref, { receipt_sent_at: now });
    return true;
  });
}

// Hand the claim back if the send actually failed, so a later webhook retry
// can try again rather than the receipt being lost forever.
async function releaseReceiptSend(paymentId) {
  try {
    await payments.doc(String(paymentId)).update({ receipt_sent_at: null });
  } catch (e) {
    // Losing the release only costs a receipt, never access. Never throw here:
    // this runs on a fire-and-forget mail path with no one to catch it.
    console.error(`[db] releaseReceiptSend failed for ${paymentId}: ${e?.message}`);
  }
}

// Replaces the raw `SELECT ... WHERE source = 'upi' ORDER BY created_at DESC`.
// Needs the composite index in firestore.indexes.json.
async function listUpiClaims(limit = 100) {
  const snap = await payments
    .where("source", "==", "upi")
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map(toRow);
}

module.exports = {
  firestore,
  getPayment,
  upsertPayment,
  isPaid,
  claimReceiptSend,
  releaseReceiptSend,
  listUpiClaims,
  LEGACY_PRICE_FLOOR_PAISE,
  COLLECTION,
};
