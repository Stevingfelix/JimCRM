"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const CreateRfqSchema = z.object({
  quote_id: z.string().uuid().nullable(),
  vendor_id: z.string().uuid(),
  part_ids: z.array(z.string().uuid()).min(1),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
});

export async function createRfq(
  input: z.input<typeof CreateRfqSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateRfqSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("vendor_rfqs")
      .insert({
        quote_id: parsed.data.quote_id,
        vendor_id: parsed.data.vendor_id,
        part_ids: parsed.data.part_ids,
        subject: parsed.data.subject,
        body: parsed.data.body,
        status: "drafted",
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    if (parsed.data.quote_id) {
      revalidatePath(`/quotes/${parsed.data.quote_id}`);
    }
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

export async function markRfqSent(
  id: string,
): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(id).success) {
    return err("validation", "Invalid id");
  }
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("vendor_rfqs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath("/quotes", "layout");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

// Server-side: read vendors that share categories with the part(s) on the
// quote. Used by the RFQ dialog to pre-populate "vendors who might quote this."
export async function suggestVendorsForRfq(args: {
  part_ids: string[];
}): Promise<
  Array<{
    id: string;
    name: string;
    categories: string[];
    contact_emails: string[];
    last_quote_age_days: number | null;
  }>
> {
  if (args.part_ids.length === 0) return [];
  const supabase = createClient();

  const { data: vendors } = await supabase
    .from("vendors")
    .select(
      "id, name, categories, vendor_contacts(email), vendor_quotes(quoted_at, part_id)",
    )
    .order("name", { ascending: true })
    .limit(50);

  type Row = {
    id: string;
    name: string;
    categories: string[] | null;
    vendor_contacts: Array<{ email: string | null }>;
    vendor_quotes: Array<{ quoted_at: string; part_id: string | null }>;
  };

  return ((vendors ?? []) as unknown as Row[]).map((v) => {
    const matched_quotes = v.vendor_quotes.filter((vq) =>
      vq.part_id ? args.part_ids.includes(vq.part_id) : false,
    );
    matched_quotes.sort(
      (a, b) => Date.parse(b.quoted_at) - Date.parse(a.quoted_at),
    );
    const last = matched_quotes[0];
    return {
      id: v.id,
      name: v.name,
      categories: v.categories ?? [],
      contact_emails: v.vendor_contacts
        .map((c) => c.email)
        .filter((e): e is string => !!e),
      last_quote_age_days: last
        ? Math.round(
            (Date.now() - Date.parse(last.quoted_at)) / (1000 * 60 * 60 * 24),
          )
        : null,
    };
  });
}
