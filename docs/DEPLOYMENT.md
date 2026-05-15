# Deployment Guide — CAP Hardware Quoting System

Single source of truth for getting the app running in production.

---

## 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | `brew install node` or nvm |
| npm | 9+ | Ships with Node |
| Supabase CLI | latest | `npm i -g supabase` |
| Wrangler CLI | latest | `npm i -g wrangler` |
| Vercel CLI | latest | `npm i -g vercel` (optional — deploy via Git push) |

**Accounts needed** (all free tier):
- [Supabase](https://supabase.com) — database, auth, storage
- [Vercel](https://vercel.com) — app hosting
- [Cloudflare](https://dash.cloudflare.com/sign-up) — Gmail polling worker
- [Google Cloud](https://console.cloud.google.com) — Gmail + Drive APIs

---

## 2. Supabase Setup

1. Create a new Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Link the CLI:
   ```sh
   supabase link --project-ref <your-project-ref>
   ```
3. Push migrations:
   ```sh
   supabase db push
   ```
4. Seed dev data (optional, recommended for first deploy):
   ```sh
   psql <your-supabase-connection-string> -f supabase/seed.sql
   ```
5. Generate TypeScript types:
   ```sh
   supabase gen types typescript --linked > src/lib/supabase/types.ts
   ```
6. Create your first user in the Supabase dashboard under Authentication → Users.

---

## 3. Google Cloud Project Setup

This is the part most likely to trip you up. Follow exactly.

### 3a. Create project + enable APIs

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → New Project.
2. APIs & Services → Library. Enable:
   - **Gmail API**
   - **Google Drive API**
   - **Google Picker API**

### 3b. OAuth consent screen

1. APIs & Services → OAuth consent screen.
2. User type: **External** (required for Workspace accounts).
3. Fill in app name ("CAP Quoting"), support email, developer email.
4. Scopes: add `gmail.readonly` and `drive.file`.
5. Test users: add Jim's team emails (up to 100 users).
6. **STOP. Do NOT click "Publish".** Keep it in **Testing** mode. Publishing triggers a multi-week Google security review that will block the app.

### 3c. Create OAuth client

1. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID.
2. Application type: **Web application**.
3. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback` (dev)
   - `https://your-app.vercel.app/api/auth/google/callback` (prod)
4. Copy **Client ID** and **Client Secret** → these become `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### 3d. Create API key for Drive Picker

1. Credentials → Create Credentials → API Key.
2. Restrict the key: Application restrictions → HTTP referrers → add your Vercel domain.
3. API restrictions → restrict to **Google Picker API** only.
4. Copy → this becomes `NEXT_PUBLIC_GOOGLE_API_KEY`.

---

## 4. Environment Variables

Copy `.env.example` to `.env.local` and fill in every value. The same vars go into Vercel (step 5).

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (keep secret) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `GOOGLE_CLIENT_ID` | Google Cloud → Credentials (step 3c) |
| `GOOGLE_CLIENT_SECRET` | Same |
| `GOOGLE_REDIRECT_URI` | `https://your-app.vercel.app/api/auth/google/callback` |
| `CRON_SECRET` | Generate: `openssl rand -base64 32` |
| `TOKEN_ENCRYPTION_KEY` | Generate: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same as `GOOGLE_CLIENT_ID` |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | Google Cloud → Credentials (step 3d) |

Optional (v1.1 push notifications):
| `GMAIL_PUBSUB_TOPIC` | See [docs/GMAIL_PUSH.md](./GMAIL_PUSH.md) |
| `GMAIL_PUSH_SECRET` | See [docs/GMAIL_PUSH.md](./GMAIL_PUSH.md) |

---

## 5. Vercel Deployment

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Next.js** (auto-detected).
3. Add all env vars from step 4 in the Vercel dashboard → Settings → Environment Variables.
4. Deploy. Vercel auto-deploys on every push to `main`.

`vercel.json` configures one cron job:
- `/api/cron/expire-quotes` — runs daily at 02:00 UTC, marks overdue quotes as expired.

---

## 6. Cloudflare Worker — Gmail Polling

The Gmail cron runs every 60 seconds via a Cloudflare Worker (free tier), since Vercel Hobby limits cron to once/day.

```sh
cd cloudflare-worker
wrangler login           # one-time browser auth
wrangler secret put APP_URL       # paste: https://your-app.vercel.app
wrangler secret put CRON_SECRET   # paste: same value as your CRON_SECRET env var
wrangler deploy
```

Verify: Cloudflare dashboard → Workers → `cap-quoting-gmail-cron` → Logs. You should see "Gmail cron OK" entries every minute.

Full details: [cloudflare-worker/README.md](../cloudflare-worker/README.md).

---

## 7. Gmail Push (Optional — v1.1)

Only needed if sub-60-second email pickup latency matters. The polling cron (step 6) handles everything at ~60s latency.

Setup requires Google Cloud Pub/Sub configuration. See [docs/GMAIL_PUSH.md](./GMAIL_PUSH.md) for the full walkthrough.

---

## 8. Verification Checklist

After deploying, confirm each item:

- [ ] App loads at your Vercel URL
- [ ] Can log in with Supabase credentials
- [ ] Can connect Gmail (OAuth flow completes, tokens stored)
- [ ] `gmail_credentials.last_polled_at` advances every ~60s (Cloudflare worker is firing)
- [ ] Sending a test email to the watched label creates a row in `email_events` within ~60s
- [ ] Can create a quote, add lines, see subtotal
- [ ] PDF generation works (download button on quote detail)
- [ ] CSV export downloads at `/api/export/csv`
- [ ] Google Drive Picker opens and attaches files to a quote
- [ ] Review queue shows extracted items from inbound emails

---

## 9. Rotating Secrets

### CRON_SECRET
Update in three places simultaneously:
1. `.env.local` (local dev)
2. Vercel → Environment Variables
3. Cloudflare Worker: `cd cloudflare-worker && wrangler secret put CRON_SECRET`

### TOKEN_ENCRYPTION_KEY
Changing this invalidates all stored Google OAuth tokens. After rotating:
1. Update in `.env.local` and Vercel.
2. Users will need to re-authorize Gmail/Drive (the app handles this gracefully — shows a "reconnect" prompt).

### Google OAuth Client Secret
1. Rotate in Google Cloud Console → Credentials.
2. Update `GOOGLE_CLIENT_SECRET` in `.env.local` and Vercel.
3. Existing refresh tokens continue to work — only new auth flows use the new secret.
