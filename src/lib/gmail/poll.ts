import { createAdminClient } from "@/lib/supabase/admin";
import {
  findLabelId,
  getMessage,
  listMessageIds,
  type ParsedMessage,
} from "./client";
import {
  getActiveCredentials,
  getValidAccessToken,
} from "./credentials";
import { extractEmailBody } from "@/lib/extractors/email-body";
import {
  enrichLine,
  findCustomerByEmail,
  lineNeedsReview,
  type EnrichedLine,
} from "@/lib/extractors/enrich";

export type PollResult = {
  status: "ok" | "not_connected" | "label_not_found";
  processed: number;
  skipped: number;
  errors: number;
  label?: string;
};

export async function pollGmail(): Promise<PollResult> {
  const creds = await getActiveCredentials();
  if (!creds) {
    return { status: "not_connected", processed: 0, skipped: 0, errors: 0 };
  }

  const supabase = createAdminClient();
  const accessToken = await getValidAccessToken(creds);
  const labelId = await findLabelId(accessToken, creds.watched_label);
  if (!labelId) {
    return {
      status: "label_not_found",
      processed: 0,
      skipped: 0,
      errors: 0,
      label: creds.watched_label,
    };
  }

  const candidateIds = await listMessageIds(accessToken, labelId, { maxResults: 25 });

  // Filter to new ones via gmail_msg_id uniqueness in email_events.
  let unseenIds = candidateIds;
  if (candidateIds.length > 0) {
    const { data: existing } = await supabase
      .from("email_events")
      .select("gmail_msg_id")
      .in("gmail_msg_id", candidateIds);
    const seen = new Set((existing ?? []).map((r) => r.gmail_msg_id));
    unseenIds = candidateIds.filter((id) => !seen.has(id));
  }

  let processed = 0;
  let errors = 0;

  for (const msgId of unseenIds) {
    try {
      const msg = await getMessage(accessToken, msgId);
      await processMessage(msg, creds.watched_label);
      processed++;
    } catch (e) {
      errors++;
      const message = e instanceof Error ? e.message : "Unknown error";
      // Best-effort: record the failure as an email_event so it's visible in review.
      await supabase.from("email_events").insert({
        gmail_msg_id: msgId,
        label: creds.watched_label,
        parse_status: "failed",
        needs_review: true,
        parsed_payload: { error: message },
      });
    }
  }

  await supabase
    .from("gmail_credentials")
    .update({ last_polled_at: new Date().toISOString() })
    .eq("id", creds.id);

  return {
    status: "ok",
    processed,
    skipped: candidateIds.length - unseenIds.length,
    errors,
    label: creds.watched_label,
  };
}

async function processMessage(
  msg: ParsedMessage,
  label: string,
): Promise<void> {
  const supabase = createAdminClient();

  // Insert in pending state first so we have a row to update on failure paths.
  const { data: inserted, error: insertErr } = await supabase
    .from("email_events")
    .insert({
      gmail_msg_id: msg.id,
      label,
      received_at: msg.internal_date,
      parse_status: "pending",
      needs_review: false,
      parsed_payload: {
        sender: { email: msg.from_email, name: msg.from_name },
        subject: msg.subject,
        body_preview: msg.body_text.slice(0, 500),
      },
    })
    .select("id")
    .single();
  if (insertErr) {
    // Likely a duplicate from a concurrent poll — safe to skip.
    if (insertErr.code === "23505") return;
    throw new Error(insertErr.message);
  }
  const eventId = inserted.id;

  // Cheap pre-filter: if the body is empty or trivially short, skip the LLM call.
  if (msg.body_text.trim().length < 20) {
    await supabase
      .from("email_events")
      .update({
        parse_status: "skipped",
        needs_review: false,
        parsed_payload: {
          sender: { email: msg.from_email, name: msg.from_name },
          subject: msg.subject,
          reason: "body_too_short",
        },
      })
      .eq("id", eventId);
    return;
  }

  // Extract with Claude
  let extraction;
  try {
    extraction = await extractEmailBody({
      subject: msg.subject,
      body_text: msg.body_text,
      from_email: msg.from_email,
      from_name: msg.from_name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "extractor failed";
    await supabase
      .from("email_events")
      .update({
        parse_status: "failed",
        needs_review: true,
        parsed_payload: {
          sender: { email: msg.from_email, name: msg.from_name },
          subject: msg.subject,
          body_preview: msg.body_text.slice(0, 1000),
          error: message,
        },
      })
      .eq("id", eventId);
    return;
  }

  // Enrich each line with part match (and identify the customer by sender email).
  const enriched: EnrichedLine[] = await Promise.all(
    extraction.lines.map((l) => enrichLine(l, supabase)),
  );

  const matchedCustomer = msg.from_email
    ? await findCustomerByEmail(msg.from_email, supabase)
    : null;

  // Needs review when any line is below threshold, no part match, only fuzzy,
  // we couldn't identify the customer, OR source_type is "other".
  const someLineSuspect = enriched.some(lineNeedsReview);
  const needsReview =
    extraction.source_type === "other" ||
    extraction.lines.length === 0 ||
    someLineSuspect ||
    !matchedCustomer;

  await supabase
    .from("email_events")
    .update({
      parse_status: "parsed",
      needs_review: needsReview,
      parsed_payload: {
        sender: { email: msg.from_email, name: msg.from_name },
        subject: msg.subject,
        body_preview: msg.body_text.slice(0, 2000),
        body_text: msg.body_text,
        extraction,
        enriched,
        matched_customer: matchedCustomer,
      },
    })
    .eq("id", eventId);
}
