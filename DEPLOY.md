# Vibe Coding Roadmap — Production Deployment

Target: **Google Cloud Run** (the server) + **Firestore** (the database) + **Firebase Hosting** (the public address).

---

## 1. How the pieces fit

The site is two halves, and only one of them is public.

- **Public half** — the HTML shell, `styles.css`, `boot.jsx`, the legal pages. Anyone may read these.
- **Paid half** — `protected/*`. Delivered *only* by `GET /api/content/:name`, and only against a valid signed access token. A token is minted only after a payment is verified server-side and recorded as `captured`. Flipping a `localStorage` flag or reading the page source unlocks nothing.

Three Google services carry this:

| Service | Role | Plain english |
|---|---|---|
| **Firestore** | Database | The ledger every payment is written to |
| **Cloud Run** | Compute | The machine running `server.js` |
| **Firebase Hosting** | Entry point | The public URL, which forwards everything to Cloud Run |

### Why Firestore replaced SQLite

The app previously used `node:sqlite`, writing to a file on local disk. **Cloud Run's filesystem is ephemeral** — it is wiped on every restart, redeploy, and scale-down. On Cloud Run that file would take every payment record with it.

So the persistence layer was rewritten against Firestore. This is the single most important thing to understand about this deployment: it was a **port, not a lift-and-shift**.

### The four invariants (read before touching `lib/db.js`)

SQL gave these guarantees for free via `ON CONFLICT`, `COALESCE`, `CASE`, `MAX`, and a conditional `UPDATE`. Firestore has none of them, so each is now re-implemented by hand inside a transaction. **Every one of them protects money.**

1. **Field merging** — Razorpay reports a payment across several messages, each carrying a different subset of fields. A later write arriving with `null` must never erase a value already stored. *(Was `COALESCE`.)*
2. **No status downgrade** — once a payment is `captured`, a later `failed`/`created` event must not move it back. Otherwise a late webhook un-sells something already paid for. *(Was `CASE WHEN`.)*
3. **Entitlement is monotonic** — once access is earned it is never revoked by a subsequent write. *(Was `MAX`.)*
4. **Exactly one receipt** — both `/api/verify-payment` and the webhook fire for the same successful payment. The send right is claimed atomically, so exactly one caller wins and the buyer is not mailed twice. *(Was `UPDATE … WHERE receipt_sent_at IS NULL`.)*

The transactions are what make concurrent verify/webhook writes for the same payment safe. **A plain read-then-write would let one silently clobber the other.**

### Async is load-bearing

`node:sqlite` was synchronous; Firestore is not. Every call site in `server.js` now `await`s. Two are worth knowing about:

- **`requireToken`** calls `isPaid()`. A Firestore outage there **fails closed** (`503`) — it must never fall through and admit an unpaid visitor.
- **`/api/webhook/razorpay`** returns **`500`** if the Firestore write fails. Returning `200` would tell Razorpay the event was handled, it would never retry, and **a captured payment would be lost silently**.

Async route handlers are wrapped in `ah()` because Express 4 does not catch rejected promises — an unhandled one would crash the process mid-payment.

---

## 2. Environment variables

Secrets live in **Secret Manager** and are injected by Cloud Run. Everything else is plain config.

### Secrets (never commit; never bake into the image)

| Var | Required | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | ✅ | `rzp_live_…` in production |
| `RAZORPAY_KEY_SECRET` | ✅ | Live secret |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ (prod) | You choose this when creating the webhook |
| `TOKEN_SECRET` | ✅ | `openssl rand -hex 32`. **Rotating it logs every buyer out** |
| `ADMIN_SECRET` | – | ≥32 chars. Enables the admin bypass + UPI approval. Empty disables both |

### Config

| Var | Required | Notes |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | – | Ambient on Cloud Run. Needed **locally** |
| `FIRESTORE_COLLECTION` | – | Default `payments`. Override only to isolate test data |
| `PRICE_PAISE` | ✅ | Server-owned price. `49900` = ₹499. The browser never chooses this |
| `PORT` | – | **Cloud Run injects `8080`** — do not hardcode |
| `NODE_ENV` | – | `production` |
| `ALLOWED_ORIGINS` | – | Comma-separated. Empty = same-origin only |

### Receipt email (currently OFF)

`lib/email.js` disables itself unless **all three** are set. They are absent today, so **no receipt is sent**.

| Var | Notes |
|---|---|
| `RESEND_API_KEY` | Resend API key |
| `MAIL_FROM` | Must be `Name <you@domain.com>` |
| `SITE_URL` | Receipt links are dead without it |

> ⚠️ **This has a real consequence.** The receipt is how a buyer learns their `payment_id`, and that ID is their only route back in via **Restore access** (there are no accounts by design). With mail off, a buyer who clears their browser has no self-serve way back — you would have to look their payment up by hand. Set these three, or accept that support burden knowingly.

> **`DB_PATH` is gone.** It was the SQLite file path and no longer exists.

---

## 3. First-time setup — already done

Recorded so it can be rebuilt or audited. **You do not need to re-run this.**

```bash
# 1. Project
firebase projects:create vibe-roadmap-prod --display-name "Vibe Coding Roadmap"

# 2. Billing — Google caps a billing account at 5 projects. That cap was hit,
#    so billing was unlinked from `jarvis-arju` to free the slot.
#    (jarvis-arju still exists and its data is intact; it just has no billing.)
gcloud billing projects link vibe-roadmap-prod --billing-account=014368-7C99B9-D4F788

# 3. APIs
gcloud services enable \
  firestore.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com \
  --project=vibe-roadmap-prod

# 4. Firestore — asia-south1 (Mumbai): closest region for an INR/Razorpay product.
#    The location is PERMANENT. It cannot be changed after creation.
gcloud firestore databases create --location=asia-south1 --project=vibe-roadmap-prod

# 5. Rules + index
firebase deploy --only firestore:rules,firestore:indexes --project vibe-roadmap-prod
```

### Secrets

Each secret is piped from `.env` via `--data-file=-` so **the value never appears in shell history or terminal output**.

```bash
for K in RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET TOKEN_SECRET ADMIN_SECRET; do
  V=$(grep -E "^${K}=" .env | cut -d= -f2-)
  printf '%s' "$V" | gcloud secrets create "$K" --data-file=- \
    --replication-policy=automatic --project=vibe-roadmap-prod
done
```

To rotate one later:

```bash
printf '%s' 'NEW_VALUE' | gcloud secrets versions add TOKEN_SECRET \
  --data-file=- --project=vibe-roadmap-prod
```

---

## 4. Security posture

**Firestore rules deny everything** (`firestore.rules`). Nothing here uses the Firestore client SDK; all access is via the Admin SDK on Cloud Run, which bypasses rules. So a total lockdown costs the app nothing.

This is not a placeholder to loosen later. The `payments` collection holds buyer emails, phone contacts, raw Razorpay payloads, and the `entitled` flag **that is the paywall**. A permissive rule would expose customer PII to anyone holding the project's public web config, and a writable `entitled` would let a browser grant itself the paid roadmap for free.

**Hosting's `public/` is deliberately empty.** Hosting serves files in `public/` *before* consulting rewrites, with no token check. Uploading the repo would publish `protected/data.js` and `protected/app.jsx` to the world and **delete the paywall entirely**. So `firebase.json` rewrites `**` to Cloud Run and `server.js` keeps ownership of every route — it already blocks sensitive paths from its static handler.

The tradeoff: static assets are served by Cloud Run instead of the CDN (slower, billed as requests). If that ever matters, serve **only** the known-public assets from `public/` — never a blanket upload.

---

## 5. Deploy

### Prerequisite: grant the runtime service account access

Cloud Run runs as the default compute service account. It needs to read Firestore and the secrets. **Without this the service starts and then fails on the first payment.**

```bash
PROJECT_NUM=$(gcloud projects describe vibe-roadmap-prod --format='value(projectNumber)')
SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding vibe-roadmap-prod \
  --member="serviceAccount:${SA}" --role="roles/datastore.user"

gcloud projects add-iam-policy-binding vibe-roadmap-prod \
  --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor"
```

### Deploy the server

`--source .` builds the `Dockerfile` with Cloud Build and deploys the result. `.dockerignore` already excludes `.env`, `data/`, and `reference/`, so **no secret is baked into the image**.

```bash
gcloud run deploy vibe-roadmap \
  --source . \
  --region asia-south1 \
  --project vibe-roadmap-prod \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PRICE_PAISE=49900,FIRESTORE_COLLECTION=payments \
  --set-secrets RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,RAZORPAY_WEBHOOK_SECRET=RAZORPAY_WEBHOOK_SECRET:latest,TOKEN_SECRET=TOKEN_SECRET:latest,ADMIN_SECRET=ADMIN_SECRET:latest
```

`--allow-unauthenticated` is correct here: this is a public storefront. The paywall is `server.js`'s token check, **not** Cloud Run's IAM.

### Point the public address at it

```bash
firebase deploy --only hosting --project vibe-roadmap-prod
```

Live at `https://vibe-roadmap-prod.web.app`.

### Verify

```bash
H=https://vibe-roadmap-prod.web.app
curl -s $H/status                                        # {"ok":true,...}
curl -s -o /dev/null -w '%{http_code}\n' $H/api/content/data.js   # MUST be 401
for p in /protected/data.js /.env /server.js /lib/db.js; do
  curl -s -o /dev/null -w "$p %{http_code}\n" $H$p       # MUST all be 404
done
```

**That `401` is the whole product.** If it ever returns `200`, the roadmap is being given away — stop and fix it before anything else.

> ⚠️ **Use `/status`, never `/healthz`, for external monitoring.**
> **Cloud Run's frontend reserves `/healthz` and answers it upstream with a 404 — the request never reaches this app.** (Verified: it returns a 404 carrying no `Server` header and leaves no entry in the request log, while every neighbouring path reaches Express normally.) The `/healthz` route still exists and works, but only from *inside* the container, which is why the Dockerfile `HEALTHCHECK` may keep using it. An uptime monitor pointed at the public `/healthz` would report this service as permanently down while it is perfectly healthy.

---

## 6. Razorpay webhook — manual, and required

**The webhook URL changes with this migration and Razorpay will not find out on its own.** Until you do this, `payment.captured` never arrives: a buyer who closes the tab before verification finishes is never recorded, and never gets access.

Dashboard → **Settings → Webhooks → Add**:

- **URL** — `https://vibe-roadmap-prod.web.app/api/webhook/razorpay` (or your custom domain)
- **Secret** — must equal `RAZORPAY_WEBHOOK_SECRET` in Secret Manager, exactly
- **Active events** — `payment.captured` (optionally `payment.failed`, `refund.processed`)

A mismatched secret fails signature verification and every event is rejected with `400`.

---

## 7. Local development

Firestore has no local file to fall back on, so you must authenticate:

```bash
gcloud auth application-default login   # once, interactive
npm ci
npm start
```

`.env` needs `GOOGLE_CLOUD_PROJECT=vibe-roadmap-prod`.

> ⚠️ **Local runs hit real production Firestore and, with `rzp_live_…` keys, real money.** To experiment safely, set `FIRESTORE_COLLECTION=payments_dev` and use `rzp_test_…` keys.

---

## 8. Operations

```bash
# Logs
gcloud run services logs tail vibe-roadmap --region asia-south1 --project vibe-roadmap-prod

# Roll back to the previous revision
gcloud run revisions list --service vibe-roadmap --region asia-south1 --project vibe-roadmap-prod
gcloud run services update-traffic vibe-roadmap --to-revisions REVISION=100 \
  --region asia-south1 --project vibe-roadmap-prod
```

### Manual UPI approval

Only if `UPI_VPA` **and** `ADMIN_SECRET` are set; otherwise these 404. Nothing tells the server a UPI payment happened, so **you approve each one by hand against your bank statement**. The payer-supplied UTR is an unverified claim, not proof.

```bash
curl -H "Authorization: Bearer $ADMIN_SECRET" https://.../api/admin/upi
curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" -H 'Content-Type: application/json' \
     -d '{"ref":"upi_…"}' https://.../api/admin/upi/approve
```

---

## 9. Deployed state (verified 2026-07-17)

| Thing | Value |
|---|---|
| Project | `vibe-roadmap-prod` (number `549243351250`) |
| Public URL | `https://vibe-roadmap-prod.web.app` |
| Cloud Run URL | `https://vibe-roadmap-549243351250.asia-south1.run.app` |
| Region | `asia-south1` |
| Firestore | Native mode, `payments` collection |
| Razorpay | **LIVE keys** |
| Console | https://console.firebase.google.com/project/vibe-roadmap-prod |

Verified against the live deployment:

- Forged/absent token → `401` on `/api/content/*`
- `protected/*`, `.env`, `server.js`, `lib/db.js`, `data/app.db` → `404`
- Webhook with a bad signature → `400`
- Webhook with a **valid** signature for a full-price payment carrying the wrong `notes.product` → recorded as `captured` but `entitled=0`, and `/api/restore` correctly returned `404`. This is the guard that stops any unrelated payment to this Razorpay account from becoming a valid access token.
- The four invariants in §1 were exercised against real Firestore, including four concurrent receipt claims yielding exactly one winner.

## 10. Known gaps

- **Receipt email is off** — see §2. This is the highest-value thing to fix.
- **Rate limiter is in-memory.** Cloud Run runs multiple instances, so each keeps its own counter and the effective limit is `max × instances`. Move to Redis, or pin `--max-instances=1`, if the limit must be exact.
- **Cold starts.** Cloud Run scales to zero; the first request after idle pays a startup penalty. `--min-instances=1` removes it, at the cost of always-on billing.
- **In-browser Babel** compiles `protected/*.jsx` on the client. Fine at this size; precompile for faster first paint.
- **Firestore region is permanent.** Moving off `asia-south1` means a new database and a data migration.
- **`firebase-admin` v14 is modular-only.** `require("firebase-admin").apps` / `.firestore()` are gone and throw at require-time — i.e. the server would not start at all. Use `firebase-admin/app` and `firebase-admin/firestore`, as `lib/db.js` does.
- **`ALLOWED_ORIGINS` contains commas**, which collide with `--set-env-vars`' own delimiter. The deploy command uses gcloud's `^@^` custom-delimiter syntax; keep it if you edit that flag.
