"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";
import { pollGmail } from "@/lib/gmail/poll";
import {
  recordNoiseSender,
  recordNoiseSendersBulk,
} from "@/lib/sender-blocklist";
import { recordAliasSuggestion } from "@/lib/alias-suggestions";

const AcceptedLineSchema = z.object({
  part_id: z.string().uuid(),
  qty: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0).nullable(),
  // Optional context for alias-suggestion capture. Not used for the
  // commit itself — purely so we can ask "did the human pick a part
  // that the AI's PN guess didn't already match?" and store the
  // pairing for later review.
  raw_text: z.string().optional().nullable(),
  part_number_guess: z.string().optional().nullable(),
  reasoning: z.string().optional().nullable(),
});

const CommitToQuoteSchema = z.object({
  event_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  lines: z.array(AcceptedLineSchema).min(1, "Pick at least one line to commit"),
});

export async function commitReviewToQuote(
  input: z.input<typeof CommitToQuoteSchema>,
): Promise<ActionResult<{ quote_id: string }>> {
  const parsed = CommitToQuoteSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);

  try {
    const supabase = createAdminClient();
    const userId = await getCurrentUserId();

    // Default template
    const { data: template } = await supabase
      .from("pdf_templates")
      .select("id")
      .eq("is_default", true)
      .maybeSingle();

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .insert({
        customer_id: parsed.data.customer_id,
        status: "draft",
        template_id: template?.id ?? null,
        internal_notes: `Auto-created from email_event ${parsed.data.event_id}`,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (qErr) return err(qErr.code ?? "db_error", qErr.message);

    const linesPayload = parsed.data.lines.map((l, i) => ({
      quote_id: quote.id,
      part_id: l.part_id,
      qty: l.qty,
      unit_price: l.unit_price,
      position: i + 1,
      created_by: userId,
      updated_by: userId,
    }));
    const { error: lErr } = await supabase
      .from("quote_lines")
      .insert(linesPayload);
    if (lErr) return err(lErr.code ?? "db_error", lErr.message);

    // Clear the review flag and link the quote.
    await supabase
      .from("email_events")
      .update({
        needs_review: false,
        linked_quote_id: quote.id,
        updated_by: userId,
      })
      .eq("id", parsed.data.event_id);

    // Capture alias suggestions for any line where the AI's PN guess
    // didn't match the part the human picked. Best-effort — never fail
    // the commit on this.
    try {
      await captureAliasSuggestions(
        parsed.data.lines.map((l) => ({
          part_id: l.part_id,
          raw_text: l.raw_text ?? null,
          part_number_guess: l.part_number_guess ?? null,
          reasoning: l.reasoning ?? null,
        })),
        parsed.data.event_id,
        "customer",
        userId,
      );
    } catch {
      // swallow
    }

    revalidatePath("/review");
    revalidatePath(`/quotes/${quote.id}`);
    return ok({ quote_id: quote.id });
  } catch (e) {
    return fromException(e);
  }
}

// Walks committed lines and writes alias suggestions when the AI's PN
// guess for a line doesn't match the picked part's internal_pn or any
// existing alias. Used by both customer-quote and vendor-quote commits.
async function captureAliasSuggestions(
  lines: Array<{
    part_id: string;
    raw_text: string | null;
    part_number_guess: string | null;
    reasoning: string | null;
  }>,
  eventId: string,
  sourceType: "customer" | "vendor",
  userId: string | null,
): Promise<void> {
  const supabase = createAdminClient();

  // Pull internal_pn for every picked part in one query.
  const partIds = Array.from(new Set(lines.map((l) => l.part_id)));
  const { data: parts } = await supabase
    .from("parts")
    .select("id, internal_pn")
    .in("id", partIds);
  const pnById = new Map<string, string>(
    (parts ?? []).map((p) => [p.id, p.internal_pn]),
  );

  for (const line of lines) {
    const guess = (line.part_number_guess ?? "").trim();
    if (!guess) continue;
    const pickedPn = pnById.get(line.part_id);
    if (pickedPn && pickedPn.toLowerCase() === guess.toLowerCase()) continue;

    await recordAliasSuggestion({
      partId: line.part_id,
      aliasPn: guess,
      rawText: line.raw_text,
      reasoning: line.reasoning,
      sourceEventId: eventId,
      sourceType,
      sourceName: null,
      userId,
    });
  }
}

const AppendToExistingQuoteSchema = z.object({
  event_id: z.string().uuid(),
  quote_id: z.string().uuid(),
  lines: z.array(AcceptedLineSchema).min(1, "Pick at least one line to commit"),
});

export async function appendLinesToExistingQuote(
  input: z.input<typeof AppendToExistingQuoteSchema>,
): Promise<ActionResult<{ quote_id: string }>> {
  const parsed = AppendToExistingQuoteSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);

  try {
    const supabase = createAdminClient();
    const userId = await getCurrentUserId();

    // Validate quote exists, is draft, and not deleted.
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("id, status, deleted_at")
      .eq("id", parsed.data.quote_id)
      .maybeSingle();
    if (qErr) return err(qErr.code ?? "db_error", qErr.message);
    if (!quote) return err("not_found", "Quote not found");
    if (quote.deleted_at) return err("validation", "Quote has been deleted");
    if (quote.status !== "draft")
      return err("validation", "Quote is not a draft — can only append to drafts");

    // Get max position from existing quote_lines for this quote.
    const { data: maxRow } = await supabase
      .from("quote_lines")
      .select("position")
      .eq("quote_id", quote.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const startPosition = (maxRow?.position ?? 0) + 1;

    const linesPayload = parsed.data.lines.map((l, i) => ({
      quote_id: quote.id,
      part_id: l.part_id,
      qty: l.qty,
      unit_price: l.unit_price,
      position: startPosition + i,
      created_by: userId,
      updated_by: userId,
    }));
    const { error: lErr } = await supabase
      .from("quote_lines")
      .insert(linesPayload);
    if (lErr) return err(lErr.code ?? "db_error", lErr.message);

    // Clear the review flag and link the quote.
    await supabase
      .from("email_events")
      .update({
        needs_review: false,
        linked_quote_id: quote.id,
        updated_by: userId,
      })
      .eq("id", parsed.data.event_id);

    // Capture alias suggestions — best-effort.
    try {
      await captureAliasSuggestions(
        parsed.data.lines.map((l) => ({
          part_id: l.part_id,
          raw_text: l.raw_text ?? null,
          part_number_guess: l.part_number_guess ?? null,
          reasoning: l.reasoning ?? null,
        })),
        parsed.data.event_id,
        "customer",
        userId,
      );
    } catch {
      // swallow
    }

    revalidatePath("/review");
    revalidatePath(`/quotes/${quote.id}`);
    return ok({ quote_id: quote.id });
  } catch (e) {
    return fromException(e);
  }
}

export async function commitReviewToQuoteAndRedirect(
  input: z.input<typeof CommitToQuoteSchema>,
) {
  const result = await commitReviewToQuote(input);
  if (result.ok) redirect(`/quotes/${result.data.quote_id}`);
  return result;
}

const AcceptedVendorLineSchema = z.object({
  part_id: z.string().uuid(),
  qty: z.coerce.number().min(0).nullable(),
  unit_price: z.coerce.number().min(0),
  lead_time_days: z.coerce.number().int().min(0).nullable(),
  raw_text: z.string().optional().nullable(),
  part_number_guess: z.string().optional().nullable(),
  reasoning: z.string().optional().nullable(),
});

const CommitToVendorQuotesSchema = z.object({
  event_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  lines: z
    .array(AcceptedVendorLineSchema)
    .min(1, "Pick at least one line to log"),
});

export async function commitReviewToVendorQuotes(
  input: z.input<typeof CommitToVendorQuotesSchema>,
): Promise<ActionResult<{ inserted: number; vendor_id: string }>> {
  const parsed = CommitToVendorQuotesSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createAdminClient();
    const userId = await getCurrentUserId();

    const now = new Date().toISOString();
    const payload = parsed.data.lines.map((l) => ({
      vendor_id: parsed.data.vendor_id,
      part_id: l.part_id,
      qty: l.qty,
      unit_price: l.unit_price,
      lead_time_days: l.lead_time_days,
      quoted_at: now,
      source_message_id: parsed.data.event_id,
      source_note: "Auto-logged from email review",
      created_by: userId,
      updated_by: userId,
    }));

    const { data: inserted, error: vqErr } = await supabase
      .from("vendor_quotes")
      .insert(payload)
      .select("id");
    if (vqErr) return err(vqErr.code ?? "db_error", vqErr.message);

    await supabase
      .from("email_events")
      .update({
        needs_review: false,
        linked_vendor_quote_ids: (inserted ?? []).map((r) => r.id),
        updated_by: userId,
      })
      .eq("id", parsed.data.event_id);

    try {
      await captureAliasSuggestions(
        parsed.data.lines.map((l) => ({
          part_id: l.part_id,
          raw_text: l.raw_text ?? null,
          part_number_guess: l.part_number_guess ?? null,
          reasoning: l.reasoning ?? null,
        })),
        parsed.data.event_id,
        "vendor",
        userId,
      );
    } catch {
      // swallow
    }

    revalidatePath("/review");
    revalidatePath(`/vendors/${parsed.data.vendor_id}`);
    return ok({
      inserted: inserted?.length ?? 0,
      vendor_id: parsed.data.vendor_id,
    });
  } catch (e) {
    return fromException(e);
  }
}

export async function rejectReview(
  eventId: string,
): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(eventId).success) {
    return err("validation", "Invalid id");
  }
  try {
    const supabase = createAdminClient();
    const userId = await getCurrentUserId();

    // Read sender_email from the existing parsed_payload BEFORE we mark
    // the row rejected so we can record it on the blocklist.
    const { data: existing } = await supabase
      .from("email_events")
      .select("parsed_payload")
      .eq("id", eventId)
      .maybeSingle();
    const sender = extractSenderEmail(existing?.parsed_payload);

    const { error } = await supabase
      .from("email_events")
      .update({
        needs_review: false,
        parse_status: "skipped",
        updated_by: userId,
      })
      .eq("id", eventId);
    if (error) return err(error.code ?? "db_error", error.message);

    if (sender) {
      try {
        await recordNoiseSender(sender, userId);
      } catch {
        // Don't fail the reject if the blocklist write hiccups.
      }
    }

    revalidatePath("/review");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

function extractSenderEmail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { sender?: { email?: string | null } };
  return p.sender?.email ?? null;
}

const BulkRejectSchema = z
  .array(z.string().uuid())
  .min(1, "Pick at least one item")
  .max(500, "Too many at once");

export async function rejectReviewBulk(
  eventIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const parsed = BulkRejectSchema.safeParse(eventIds);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createAdminClient();
    const userId = await getCurrentUserId();

    // Read sender_email for each id BEFORE the update so we can blocklist
    // them in one batch after the reject lands.
    const { data: existingRows } = await supabase
      .from("email_events")
      .select("parsed_payload")
      .in("id", parsed.data);
    const senders = (existingRows ?? []).map((r) =>
      extractSenderEmail(r.parsed_payload),
    );

    const { data, error } = await supabase
      .from("email_events")
      .update({
        needs_review: false,
        parse_status: "skipped",
        updated_by: userId,
      })
      .in("id", parsed.data)
      .select("id");
    if (error) return err(error.code ?? "db_error", error.message);

    try {
      await recordNoiseSendersBulk(senders, userId);
    } catch {
      // best-effort; don't fail the reject
    }

    revalidatePath("/review");
    return ok({ count: data?.length ?? 0 });
  } catch (e) {
    return fromException(e);
  }
}

export async function pollNow(): Promise<ActionResult<{ processed: number }>> {
  try {
    const result = await pollGmail();
    revalidatePath("/review");
    return ok({ processed: result.processed });
  } catch (e) {
    return fromException(e);
  }
}

export async function disconnectGmail(): Promise<ActionResult<void>> {
  try {
    const { disconnect } = await import("@/lib/gmail/credentials");
    await disconnect();
    revalidatePath("/review");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function updateWatchedLabel(
  label: string,
): Promise<ActionResult<void>> {
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > 200) {
    return err("validation", "Label must be 1-200 characters");
  }
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("gmail_credentials")
      .update({ watched_label: trimmed })
      .eq("is_active", true);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath("/review");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}
