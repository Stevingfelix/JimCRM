import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getActiveCredentials,
  getValidAccessToken,
} from "./credentials";
import { getMessage } from "./client";
import { processMessage } from "./poll";

const PUBSUB_TOPIC = process.env.GMAIL_PUBSUB_TOPIC; // e.g. projects/<project>/topics/gmail-notifications

function gmail(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

// Tells Gmail to start pushing change notifications to our Pub/Sub topic.
// Watch expires after 7 days — we re-call this weekly via cron.
export async function startWatch(): Promise<
  | { ok: true; historyId: string; expiration: string }
  | { ok: false; error: string }
> {
  if (!PUBSUB_TOPIC) return { ok: false, error: "GMAIL_PUBSUB_TOPIC env var not set" };

  const creds = await getActiveCredentials();
  if (!creds) return { ok: false, error: "Gmail not connected" };

  const accessToken = await getValidAccessToken(creds);

  // Find the label ID first so we can scope the watch to that label only
  // (instead of the entire mailbox).
  const labels = await gmail(accessToken).users.labels.list({ userId: "me" });
  const label = labels.data.labels?.find(
    (l) => l.name?.toLowerCase() === creds.watched_label.toLowerCase(),
  );

  try {
    const res = await gmail(accessToken).users.watch({
      userId: "me",
      requestBody: {
        topicName: PUBSUB_TOPIC,
        labelIds: label?.id ? [label.id] : undefined,
        labelFilterBehavior: label?.id ? "include" : undefined,
      },
    });
    const historyId = String(res.data.historyId ?? "");
    const expirationMs = Number(res.data.expiration ?? 0);
    const expiration = expirationMs
      ? new Date(expirationMs).toISOString()
      : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const supabase = createAdminClient();
    await supabase
      .from("gmail_credentials")
      .update({
        last_history_id: historyId,
        watch_expiration: expiration,
      })
      .eq("id", creds.id);

    return { ok: true, historyId, expiration };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "watch failed" };
  }
}

// Stop Gmail from pushing notifications.
export async function stopWatch(): Promise<void> {
  const creds = await getActiveCredentials();
  if (!creds) return;
  const accessToken = await getValidAccessToken(creds);
  try {
    await gmail(accessToken).users.stop({ userId: "me" });
  } catch {
    // tolerant — if it wasn't watching, nothing to stop.
  }
  const supabase = createAdminClient();
  await supabase
    .from("gmail_credentials")
    .update({ last_history_id: null, watch_expiration: null })
    .eq("id", creds.id);
}

// Called by the Pub/Sub webhook with a historyId. Fetches the diff via
// gmail.users.history.list() and processes any new messages.
export async function processHistorySince(
  newHistoryId: string,
): Promise<{ processed: number; errors: number }> {
  const creds = await getActiveCredentials();
  if (!creds) return { processed: 0, errors: 0 };
  const startId = creds.last_history_id ?? newHistoryId;
  const accessToken = await getValidAccessToken(creds);

  const supabase = createAdminClient();

  let processed = 0;
  let errors = 0;

  try {
    const res = await gmail(accessToken).users.history.list({
      userId: "me",
      startHistoryId: startId,
      historyTypes: ["messageAdded"],
    });

    const messageIds = new Set<string>();
    for (const h of res.data.history ?? []) {
      for (const m of h.messagesAdded ?? []) {
        if (m.message?.id) messageIds.add(m.message.id);
      }
    }

    if (messageIds.size > 0) {
      const ids = [...messageIds];
      const { data: existing } = await supabase
        .from("email_events")
        .select("gmail_msg_id")
        .in("gmail_msg_id", ids);
      const seen = new Set((existing ?? []).map((r) => r.gmail_msg_id));
      const unseen = ids.filter((id) => !seen.has(id));

      // Same per-tick cap as the polling path — Vercel Hobby 10s timeout.
      const MAX_PER_TICK = 3;
      const batch = unseen.slice(0, MAX_PER_TICK);

      for (const msgId of batch) {
        try {
          const msg = await getMessage(accessToken, msgId);
          await processMessage(msg, creds.watched_label, accessToken);
          processed++;
        } catch (e) {
          errors++;
          const message = e instanceof Error ? e.message : "Unknown error";
          await supabase.from("email_events").insert({
            gmail_msg_id: msgId,
            label: creds.watched_label,
            parse_status: "failed",
            needs_review: true,
            parsed_payload: { error: message },
          });
        }
      }
    }

    await supabase
      .from("gmail_credentials")
      .update({ last_history_id: newHistoryId })
      .eq("id", creds.id);

    return { processed, errors };
  } catch (e) {
    // 404 from history.list means historyId is too old (Gmail keeps ~7 days).
    // Fall back: just update the cursor; next watch tick will move forward.
    if (e instanceof Error && /404|history/i.test(e.message)) {
      await supabase
        .from("gmail_credentials")
        .update({ last_history_id: newHistoryId })
        .eq("id", creds.id);
    }
    return { processed, errors: errors + 1 };
  }
}
