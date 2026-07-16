# Vibe Coding Roadmap — Production Deployment

## What changed (why this is now production-ready)

The paid roadmap (`protected/data.js`, `protected/sections-*.jsx`, `protected/app.jsx`)
is **no longer served as flat static files**. It is delivered only from
`GET /api/content/:name`, which requires a valid **signed access token**. A token
is minted **only** after a payment is verified server-side and recorded as
`captured`. Flipping a `localStorage` flag or reading the JS no longer unlocks anything.

- **DB** — `node:sqlite` (built in, no dependency) records every payment as the source of truth (`lib/db.js`).
- **Tokens** — HMAC-signed, keyed by `TOKEN_SECRET` (`lib/tokens.js`). Can't be forged client-side.
- **Webhook** — `POST /api/webhook/razorpay` records `payment.captured` even if the buyer closes the tab.
- **Restore** — `POST /api/restore` lets a paid user re-unlock on a new device with their payment ID (no accounts by design).
- **Hardening** — CORS allowlist, sensitive paths blocked from static, `/healthz`, rate limiting.

## Environment variables (`.env`)

| Var | Required | Notes |
|-----|----------|-------|
| `RAZORPAY_KEY_ID` | ✅ | `rzp_live_…` in production |
| `RAZORPAY_KEY_SECRET` | ✅ | Live secret — keep out of git |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ (prod) | You set this when creating the webhook |
| `TOKEN_SECRET` | ✅ | `openssl rand -hex 32`. Rotating it logs everyone out |
| `PORT` | – | Default 3333; we run 3012 |
| `NODE_ENV` | – | `production` in prod |
| `ALLOWED_ORIGINS` | – | Comma-separated; empty = same-origin only |
| `DB_PATH` | – | Point at a persistent volume in prod |

## Run

```bash
npm ci
npm start            # http://localhost:3012
```

### Docker
```bash
docker build -t vibe-roadmap .
docker run -p 3012:3012 --env-file .env -v vibe_data:/app/data vibe-roadmap
```

## Razorpay webhook setup
Dashboard → Settings → Webhooks → Add:
- URL: `https://YOUR_DOMAIN/api/webhook/razorpay`
- Secret: a random string → put the same value in `RAZORPAY_WEBHOOK_SECRET`
- Active events: `payment.captured` (and optionally `payment.failed`, `refund.processed`)

## VPS deployment (your chosen path)

On the server (Ubuntu/Debian assumed):

```bash
# 1. Node 22+ (node:sqlite needs >=22.5)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# 2. App
sudo mkdir -p /var/www/vibe-roadmap && cd /var/www/vibe-roadmap
# ...copy the project here (git clone / rsync)...
npm ci --omit=dev
cp .env.example .env      # then fill in LIVE keys + secrets (see below)

# 3. Persistent DB path (survives redeploys)
#   set DB_PATH=/var/lib/vibe-roadmap/app.db in .env
sudo mkdir -p /var/lib/vibe-roadmap && sudo chown www-data:www-data /var/lib/vibe-roadmap

# 4a. Process manager — pm2
sudo npm i -g pm2
pm2 start ecosystem.config.js && pm2 save && pm2 startup
#   ...or 4b. systemd:  use deploy/vibe-roadmap.service

# 5. Reverse proxy + TLS
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/vibe-roadmap
#   edit YOUR_DOMAIN, then:
sudo ln -s /etc/nginx/sites-available/vibe-roadmap /etc/nginx/sites-enabled/
sudo certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
sudo nginx -t && sudo systemctl reload nginx
```

`trust proxy` is already enabled in `server.js`, so rate limiting sees the real
client IP behind nginx.

## Notes / future
- Rate limiter is in-memory — move to Redis if you run more than one instance.
- `data/` (SQLite) must be on a persistent volume or payments are lost on redeploy.
- In-browser Babel is fine for this size; precompile `protected/*.jsx` if you want faster first paint.
