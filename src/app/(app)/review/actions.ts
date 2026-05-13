"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";
import { pollGmail } from "@/lib/gmail/poll";

const AcceptedLineSchema = z.object({
  part_id: z.string().uuid(),
  qty: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0).nullable(),
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
    const { error } = await supabase
      .from("email_events")
      .update({
        needs_review: false,
        parse_status: "skipped",
        updated_by: userId,
      })
      .eq("id", eventId);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath("/review");
    return ok(undefined);
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
