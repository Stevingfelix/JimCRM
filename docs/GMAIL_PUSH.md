# Gmail Push notifications (Pub/Sub) — optional v1.1 setup

The app supports two ways to get new emails from Gmail:

1. **Polling (default)**: A cron pings `/api/cron/gmail` every minute. Simple,
   already working out of the box.
2. **Push (this doc)**: Gmail publishes a notification to a Google Cloud
   Pub/Sub topic the moment something changes. Pub/Sub then POSTs to our
   `/api/gmail/push` endpoint. Latency drops from ~60s to ~1–3s.

Push is **strictly optional**. The brief specifies polling for v1; this is
v1.1 scope.

## Trade-offs

| | Polling | Push |
|---|---|---|
| Setup time | Already done | ~30 min in Google Cloud Console |
| Latency | Up to 60s | ~1–3s |
| Cost | $0 | $0 (Pub/Sub free tier covers it) |
| Operational burden | None | 7-day watch expiration; needs weekly renewal cron |
| Failure mode | Cron just retries on next tick | If Pub/Sub or watch breaks, you need to notice |

If Jim never complains about email-pickup latency, **skip this entire doc**.

## Setup

### 1. Enable Pub/Sub API

In your Google Cloud project:
- APIs & Services → Library → search "Cloud Pub/Sub API" → Enable

### 2. Create the topic

- Pub/Sub → Topics → Create topic
- Name: `gmail-notifications` (or whatever; you'll paste the full path into
  the env var)
- Click Create

### 3. Grant Gmail permission to publish

- Click the new topic → Permissions tab → "Add principal"
- New principals: `gmail-api-push@system.gserviceaccount.com`
- Role: `Pub/Sub Publisher`
- Save

### 4. Create the push subscription

- The topic → Subscriptions tab → "Create subscription"
- Subscription ID: `gmail-to-our-app`
- Delivery type: **Push**
- Endpoint URL:
  `https://your-app.vercel.app/api/gmail/push?token=<GMAIL_PUSH_SECRET value>`
- Ack deadline: 60 seconds
- Authentication: optional (the URL token IS our auth)
- Create

### 5. Set the env vars

In `.env.local` and Vercel project env vars:

```
GMAIL_PUBSUB_TOPIC=projects/<your-gcp-project-id>/topics/gmail-notifications
GMAIL_PUSH_SECRET=<a long random string>
```

The secret must match what you put in the push subscription's URL query
parameter.

### 6. Start the watch

After Jim has connected his Gmail in the app, you (an admin) hit:

```sh
curl -X POST https://your-app.vercel.app/api/gmail/watch \
  -H "Cookie: <session cookie from a logged-in admin>"
```

Or, more practically, open the browser's DevTools while logged into the app
and run:

```js
fetch("/api/gmail/watch", { method: "POST" }).then((r) => r.json()).then(console.log)
```

Response: `{ ok: true, historyId: "...", expiration: "..." }`

From this point, Gmail will push notifications to Pub/Sub whenever a new
message hits the watched label. Pub/Sub will forward to
`/api/gmail/push?token=...`, our app fetches the delta via
`gmail.users.history.list()`, and processes new messages exactly the same
way the polling path does.

### 7. Schedule the weekly renewal

Gmail's watch expires after 7 days. Renew it weekly.

Option A — Vercel Cron (Pro):
```json
{
  "path": "/api/cron/gmail-watch-renew",
  "schedule": "0 6 * * 1"
}
```

Option B — Cloudflare Worker (the existing setup):
Add a second scheduled trigger to your worker with `crons = ["0 6 * * 1"]`
that hits `/api/cron/gmail-watch-renew?secret=<CRON_SECRET>`.

Option C — cron-job.org or any external scheduler:
Same URL, same secret, weekly schedule.

## Turning it off

To go back to polling:
- Hit `DELETE /api/gmail/watch` (or call from DevTools)
- That stops Gmail from publishing
- Remove the GMAIL_PUBSUB_TOPIC env var (optional)
- The existing polling cron keeps running unchanged

You can run BOTH push and polling simultaneously — the `gmail_msg_id` unique
index dedupes anything either path picks up. Push is essentially "polling
catches up faster."

## Verifying it works

1. Send a test email to the watched label
2. Within ~2–3 seconds, you should see:
   - A POST hit to `/api/gmail/push` (visible in Vercel logs)
   - A new row in `email_events`
   - The notification bell in the app turns red

If nothing happens:
- Check Pub/Sub → Subscriptions → your subscription → Metrics: "Unacked
  message count" should NOT be growing (would mean we're returning errors)
- Check Vercel logs for any errors on `/api/gmail/push`
- Verify `GMAIL_PUSH_SECRET` matches in env AND in the subscription URL

## Skipping all of this

If you don't want to set up push, change nothing. The polling cron continues
to work. Push is a latency optimization, not a requirement.
