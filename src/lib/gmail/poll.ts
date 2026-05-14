import { createAdminClient } from "@/lib/supabase/admin";
import {
  findLabelId,
  getMessage,
  listMessageIds,
  type ParsedMessage,
} from "./client";
import { attachmentKind, fetchAttachmentBytes } from "./attachments";
import {
  getActiveCredentials,
  getValidAccessToken,
} from "./credentials";
import { extractEmailBody } from "@/lib/extractors/email-body";
import { extractPdfAttachment } from "@/lib/extractors/pdf-attachment";
import { extractExcelAttachment } from "@/lib/extractors/excel-attachment";
import {
  enrichLine,
  findCustomerByEmail,
  lineNeedsReview,
  type EnrichedLine,
} from "@/lib/extractors/enrich";
import type { ExtractionResult } from "@/lib/extractors/_pattern";

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

  let unseenIds = candidateIds;
  if (candidateIds.length > 0) {
    const { data: existing } = await supabase
      .from("email_events")
      .select("gmail_msg_id")
      .in("gmail_msg_id", candidateIds);
    const seen = new Set((existing ?? []).map((r) => r.gmail_msg_id));
    unseenIds = candidateIds.filter((id) => !seen.has(id));
  }

  // Cap per cron tick so we always finish inside Vercel Hobby's 10s timeout.
  // Each email costs ~3s (body) up to ~10s (with a heavy PDF attachment),
  // so 3 per tick is the safe ceiling. On Vercel Pro (60s timeout) this can
  // be raised or removed.
  const MAX_PER_TICK = 3;
  const batch = unseenIds.slice(0, MAX_PER_TICK);
  const deferred = unseenIds.length - batch.length;

  let processed = 0;
  let errors = 0;

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

  await supabase
    .from("gmail_credentials")
    .update({ last_polled_at: new Date().toISOString() })
    .eq("id", creds.id);

  return {
    status: "ok",
    processed,
    // already-seen emails this tick + new emails deferred to a future tick
    skipped: candidateIds.length - unseenIds.length + deferred,
    errors,
    label: creds.watched_label,
  };
}

export async function processMessage(
  msg: ParsedMessage,
  label: string,
  accessToken: string,
): Promise<void> {
  const supabase = createAdminClient();

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
        attachments_meta: msg.attachments.map((a) => ({
          filename: a.filename,
          mime_type: a.mime_type,
          size: a.size,
          kind: attachmentKind({ filename: a.filename, mimeType: a.mime_type }),
        })),
      },
    })
    .select("id")
    .single();
  if (insertErr) {
    if (insertErr.code === "23505") return; // duplicate from concurrent poll
    throw new Error(insertErr.message);
  }
  const eventId = inserted.id;

  // Run email-body extractor (cheap pre-filter for trivially short bodies).
  let bodyExtraction: ExtractionResult | null = null;
  let bodyError: string | null = null;
  if (msg.body_text.trim().length >= 20) {
    try {
      bodyExtraction = await extractEmailBody({
        subject: msg.subject,
        body_text: msg.body_text,
        from_email: msg.from_email,
        from_name: msg.from_name,
      });
    } catch (e) {
      bodyError = e instanceof Error ? e.message : "email-body extractor failed";
    }
  }

  // Run attachment extractors. Run sequentially to bound concurrent Anthropic
  // calls and keep cost predictable per poll tick.
  const attachmentExtractions: Array<{
    filename: string;
    kind: "pdf" | "excel";
    extraction: ExtractionResult | null;
    error: string | null;
  }> = [];
  for (const att of msg.attachments) {
    const kind = attachmentKind({
      filename: att.filename,
      mimeType: att.mime_type,
    });
    if (!kind) continue;
    try {
      const buffer = await fetchAttachmentBytes(
        accessToken,
        msg.id,
        att.attachment_id,
      );
      const extraction =
        kind === "pdf"
          ? await extractPdfAttachment({ filename: att.filename, buffer })
          : await extractExcelAttachment({ filename: att.filename, buffer });
      attachmentExtractions.push({
        filename: att.filename,
        kind,
        extraction,
        error: null,
      });
    } catch (e) {
      attachmentExtractions.push({
        filename: att.filename,
        kind,
        extraction: null,
        error: e instanceof Error ? e.message : "attachment extractor failed",
      });
    }
  }

  // If everything failed AND nothing was extracted, mark the event for review.
  const allFailed =
    bodyError !== null &&
    (attachmentExtractions.length === 0 ||
      attachmentExtractions.every((a) => a.error !== null));
  if (allFailed) {
    await supabase
      .from("email_events")
      .update({
        parse_status: "failed",
        needs_review: true,
        parsed_payload: {
          sender: { email: msg.from_email, name: msg.from_name },
          subject: msg.subject,
          body_preview: msg.body_text.slice(0, 1000),
          body_error: bodyError,
          attachments: attachmentExtractions,
        },
      })
      .eq("id", eventId);
    return;
  }

  // Skip if body was empty AND no attachments. Mark skipped.
  if (!bodyExtraction && attachmentExtractions.length === 0) {
    await supabase
      .from("email_events")
      .update({
        parse_status: "skipped",
        needs_review: false,
        parsed_payload: {
          sender: { email: msg.from_email, name: msg.from_name },
          subject: msg.subject,
          reason: "body_too_short_and_no_attachments",
        },
      })
      .eq("id", eventId);
    return;
  }

  // Merge all extracted lines, tagging the source.
  const mergedRaw: Array<{ line: import("@/lib/extractors/_pattern").ExtractedLine; source: string }> = [];
  if (bodyExtraction) {
    for (const l of bodyExtraction.lines) {
      mergedRaw.push({ line: l, source: "email_body" });
    }
  }
  for (const a of attachmentExtractions) {
    if (!a.extraction) continue;
    for (const l of a.extraction.lines) {
      mergedRaw.push({ line: l, source: `${a.kind}:${a.filename}` });
    }
  }

  // Enrich each line (alias lookup, customer match).
  const enriched: EnrichedLine[] = [];
  for (const item of mergedRaw) {
    const e = await enrichLine(item.line, supabase);
    e.extraction_source = item.source;
    enriched.push(e);
  }

  const matchedCustomer = msg.from_email
    ? await findCustomerByEmail(msg.from_email, supabase)
    : null;

  // Effective source_type: prefer body's verdict; fall back to first
  // attachment that produced lines.
  const effectiveSourceType: ExtractionResult["source_type"] =
    bodyExtraction?.source_type ??
    attachmentExtractions.find((a) => a.extraction && a.extraction.lines.length > 0)
      ?.extraction?.source_type ??
    "other";

  const someLineSuspect = enriched.some(lineNeedsReview);
  const needsReview =
    effectiveSourceType === "other" ||
    enriched.length === 0 ||
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
        body_text: msg.body_text,
        extraction: {
          source_type: effectiveSourceType,
          customer_or_vendor_hint:
            bodyExtraction?.customer_or_vendor_hint ??
            attachmentExtractions.find((a) => a.extraction?.customer_or_vendor_hint)
              ?.extraction?.customer_or_vendor_hint ??
            null,
          lines: mergedRaw.map((x) => x.line),
        },
        attachments: attachmentExtractions,
        enriched,
        matched_customer: matchedCustomer,
      },
    })
    .eq("id", eventId);
}
