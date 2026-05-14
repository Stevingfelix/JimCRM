# Cloudflare Workers Gmail Cron

This directory contains a tiny Cloudflare Worker whose only job is to hit the
Next.js app's `/api/cron/gmail` endpoint every minute. It replaces Vercel
Cron, which is capped to once-per-day on the Hobby (free) plan.

Cost: **$0** at our volume (1,440 invocations/day, well under Cloudflare's
free tier of 100,000/day).

## Why this exists

Vercel Hobby's cron limits make 1-minute Gmail polling impossible without
upgrading to Pro ($20/mo). Cloudflare Workers Cron has no such limit and
runs on Cloudflare's global edge network — better uptime than any third-
party cron service, and effectively free forever.

The Next.js app's code does not change. This worker is a separate, tiny
deployment that lives on Cloudflare and just pings a URL on a schedule.

## Setup (one-time, ~10 minutes)

### 1. Sign up for Cloudflare

Free account at <https://dash.cloudflare.com/sign-up>. No credit card.

### 2. Install Wrangler (the Cloudflare CLI)

```sh
npm install -g wrangler
```

### 3. Log in

```sh
wrangler login
```

A browser tab opens — authorize. Closes automatically.

### 4. Set your two secrets

These tell the worker where to ping and how to authenticate.

```sh
cd cloudflare-worker

# Your deployed Next.js URL (no trailing slash)
wrangler secret put APP_URL
# When prompted, paste: https://your-app.vercel.app

# Same value as CRON_SECRET in your app's .env.local + Vercel env vars
wrangler secret put CRON_SECRET
# When prompted, paste the secret value
```

### 5. Deploy the worker

```sh
wrangler deploy
```

That's it. The worker is now hitting your `/api/cron/gmail` endpoint every
60 seconds.

## Verify it's working

### Cloudflare dashboard
1. <https://dash.cloudflare.com> → Workers & Pages → `cap-quoting-gmail-cron`
2. The "Logs" tab shows each invocation. You should see "Gmail cron OK: …"
   entries arriving every minute.

### Your Supabase dashboard
The `gmail_credentials.last_polled_at` column updates every minute as a
side-effect of the poll. If it's advancing, the worker is firing.

### From the app
The notification bell (top-right) will fire whenever new `email_events`
rows are inserted. If you send a test email to Jim's watched Gmail label,
it should appear in `/review` within ~60 seconds.

## Updating the worker

If `worker.js` changes, re-deploy:

```sh
cd cloudflare-worker
wrangler deploy
```

If you rotate `CRON_SECRET` (you should, periodically):

```sh
wrangler secret put CRON_SECRET
# Paste the new value
```

You ALSO need to update the same secret in:
- Your `.env.local` (for local dev)
- Vercel project env vars (for the deployed app)

## Switching away (if needed)

If Cloudflare ever becomes inconvenient (price change, outage, etc.), you
can swap to any other cron service in 5 minutes — the Next.js endpoint
stays the same. Options that work identically:

- **cron-job.org** — web form, free, German-based
- **Vercel Cron** — upgrade Vercel to Pro ($20/mo) and re-add the entry to
  `vercel.json`. Simplest mental model if you're paying for Pro anyway.

No code change needed in the Next.js app — just a different scheduler
hitting the same URL.
