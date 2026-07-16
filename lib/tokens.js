// ============================================================
// Stateless access tokens (a minimal signed token, JWT-style).
// Format:  base64url(payload).base64url(hmacSHA256(payload))
// The signature is keyed by TOKEN_SECRET, so a token cannot be
// forged client-side — flipping a localStorage flag no longer works.
// ============================================================

const crypto = require("crypto");

const TOKEN_SECRET = process.env.TOKEN_SECRET || "";
// 10 years — this product sells "lifetime access".
const DEFAULT_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000;

if (!TOKEN_SECRET) {
  // Surfaced loudly at boot rather than silently issuing forgeable tokens.
  console.error("FATAL: TOKEN_SECRET is not set. Generate one with:  openssl rand -hex 32");
  process.exit(1);
}
if (TOKEN_SECRET.length < 32) {
  console.warn("WARNING: TOKEN_SECRET is short (<32 chars). Use at least 32 random bytes.");
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

function sign(payloadObj) {
  const payload = b64url(JSON.stringify(payloadObj));
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

// Mint a token bound to a specific (verified, captured) payment.
function issueToken(paymentId, { ttlMs = DEFAULT_TTL_MS, now = Date.now() } = {}) {
  return sign({ pid: paymentId, iat: now, exp: now + ttlMs });
}

// Returns the decoded payload if valid & unexpired, else null. Constant-time sig compare.
function verifyToken(token, now = Date.now()) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data || typeof data.exp !== "number" || data.exp < now) return null;
  return data;
}

module.exports = { issueToken, verifyToken };
