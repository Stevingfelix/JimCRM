/**
 * Cloudflare Worker — pings the Gmail-polling endpoint every minute.
 *
 * Runs ENTIRELY on Cloudflare's edge network. Has nothing to do with the
 * Next.js app's code other than hitting one URL on a schedule.
 *
 * Environment variables (set via `wrangler secret put`):
 *   APP_URL      — your deployed Next.js URL, e.g. https://jim-crm.vercel.app
 *   CRON_SECRET  — same value as the CRON_SECRET in your app's .env.local /
 *                  Vercel env vars. Sent as a Bearer token.
 */

export default {
  async scheduled(_event, env, ctx) {
    const url = `${env.APP_URL}/api/cron/gmail`;
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.CRON_SECRET}`,
          "User-Agent": "cap-quoting-gmail-cron/cloudflare",
        },
      });

      const body = await resp.text();
      if (!resp.ok) {
        console.error(
          `Gmail cron returned non-200: ${resp.status} — ${body.slice(0, 300)}`,
        );
        // ctx.waitUntil keeps the worker alive long enough to log even if
        // scheduled() returns. (Not strictly needed here since we're already
        // awaiting, but useful pattern.)
        ctx.waitUntil(Promise.resolve());
      } else {
        console.log(`Gmail cron OK: ${body.slice(0, 200)}`);
      }
    } catch (e) {
      console.error(
        `Gmail cron fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  },
};
