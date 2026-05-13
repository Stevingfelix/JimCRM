"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const QUOTE_STATUSES = ["draft", "sent", "won", "lost", "expired"] as const;

const CreateQuoteSchema = z.object({
  customer_id: z.string().uuid(),
  validity_date: z.string().date().optional().nullable(),
  internal_notes: z.string().trim().max(2000).optional().nullable(),
});

export async function createQuote(
  input: z.input<typeof CreateQuoteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateQuoteSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();

    const { data: template } = await supabase
      .from("pdf_templates")
      .select("id")
      .eq("is_default", true)
      .maybeSingle();

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        customer_id: parsed.data.customer_id,
        validity_date: parsed.data.validity_date ?? null,
        internal_notes: parsed.data.internal_notes ?? null,
        status: "draft",
        template_id: template?.id ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath("/quotes");
    revalidatePath(`/customers/${parsed.data.customer_id}`);
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

export async function createQuoteAndRedirect(
  input: z.input<typeof CreateQuoteSchema>,
) {
  const result = await createQuote(input);
  if (result.ok) redirect(`/quotes/${result.data.id}`);
  return result;
}

const UpdateQuoteSchema = z.object({
  id: z.string().uuid(),
  validity_date: z.string().date().nullable(),
  customer_notes: z.string().trim().max(4000).nullable(),
  internal_notes: z.string().trim().max(4000).nullable(),
  template_id: z.string().uuid().nullable(),
});

export async function updateQuote(
  input: z.input<typeof UpdateQuoteSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateQuoteSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("quotes")
      .update({
        validity_date: parsed.data.validity_date,
        customer_notes: parsed.data.customer_notes,
        internal_notes: parsed.data.internal_notes,
        template_id: parsed.data.template_id,
        updated_by: userId,
      })
      .eq("id", parsed.data.id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/quotes/${parsed.data.id}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(QUOTE_STATUSES),
});

export async function updateQuoteStatus(
  input: z.input<typeof UpdateStatusSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateStatusSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("quotes")
      .update({
        status: parsed.data.status,
        updated_by: userId,
        ...(parsed.data.status === "sent"
          ? { sent_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", parsed.data.id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/quotes/${parsed.data.id}`);
    revalidatePath("/quotes");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

const AddLineSchema = z.object({
  quote_id: z.string().uuid(),
  part_id: z.string().uuid().nullable(),
  qty: z.coerce.number().min(0).max(1_000_000),
  unit_price: z.coerce.number().min(0).max(1_000_000).nullable(),
});

export async function addLine(
  input: z.input<typeof AddLineSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AddLineSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();

    const { data: existing } = await supabase
      .from("quote_lines")
      .select("position")
      .eq("quote_id", parsed.data.quote_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = (existing?.position ?? 0) + 1;

    const { data, error } = await supabase
      .from("quote_lines")
      .insert({
        quote_id: parsed.data.quote_id,
        part_id: parsed.data.part_id,
        qty: parsed.data.qty,
        unit_price: parsed.data.unit_price,
        position: nextPosition,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/quotes/${parsed.data.quote_id}`);
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

const UpdateLineSchema = z.object({
  id: z.string().uuid(),
  quote_id: z.string().uuid(),
  part_id: z.string().uuid().nullable(),
  qty: z.coerce.number().min(0).max(1_000_000),
  unit_price: z.coerce.number().min(0).max(1_000_000).nullable(),
  override_reason: z.string().trim().max(500).nullable(),
  line_notes_internal: z.string().trim().max(2000).nullable(),
  line_notes_customer: z.string().trim().max(2000).nullable(),
});

export async function updateLine(
  input: z.input<typeof UpdateLineSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateLineSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("quote_lines")
      .update({
        part_id: parsed.data.part_id,
        qty: parsed.data.qty,
        unit_price: parsed.data.unit_price,
        override_reason: parsed.data.override_reason,
        line_notes_internal: parsed.data.line_notes_internal,
        line_notes_customer: parsed.data.line_notes_customer,
        updated_by: userId,
      })
      .eq("id", parsed.data.id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/quotes/${parsed.data.quote_id}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function deleteLine({
  id,
  quote_id,
}: {
  id: string;
  quote_id: string;
}): Promise<ActionResult<void>> {
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(quote_id).success
  ) {
    return err("validation", "Invalid id");
  }
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("quote_lines")
      .delete()
      .eq("id", id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/quotes/${quote_id}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function softDeleteQuote(id: string): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(id).success) {
    return err("validation", "Invalid id");
  }
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("quotes")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq("id", id);
    if (error) return err(error.code ?? "db_error", error.message);
  } catch (e) {
    return fromException(e);
  }
  revalidatePath("/quotes");
  redirect("/quotes");
}
