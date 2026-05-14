"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const QUOTE_STATUSES = ["draft", "sent", "won", "lost", "expired"] as const;

const CreateQuoteSchema = z.object({
  customer_id: z.string().uuid(),
  validity_date: z.string().date().optional().nullable(),
  customer_notes: z.string().trim().max(4000).optional().nullable(),
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

    // Per client requirements: validity defaults to 30 days from today if
    // not explicitly provided. Jim can override on the builder.
    const validity =
      parsed.data.validity_date ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        customer_id: parsed.data.customer_id,
        validity_date: validity,
        customer_notes: parsed.data.customer_notes ?? null,
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
  outcome_reason: z.string().trim().max(500).optional().nullable(),
});

const TERMINAL_STATUSES = new Set(["won", "lost", "expired"]);

export async function updateQuoteStatus(
  input: z.input<typeof UpdateStatusSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateStatusSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    const terminal = TERMINAL_STATUSES.has(parsed.data.status);
    const { error } = await supabase
      .from("quotes")
      .update({
        status: parsed.data.status,
        updated_by: userId,
        ...(parsed.data.status === "sent" ? { sent_at: now } : {}),
        // Won/lost/expired: record outcome reason + when. Going back to
        // draft/sent clears the prior outcome data.
        outcome_reason: terminal ? parsed.data.outcome_reason ?? null : null,
        outcome_at: terminal ? now : null,
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

const DuplicateQuoteSchema = z.object({
  source_id: z.string().uuid(),
});

export async function duplicateQuote(
  input: z.input<typeof DuplicateQuoteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = DuplicateQuoteSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();

    const { data: source, error: srcErr } = await supabase
      .from("quotes")
      .select(
        "customer_id, customer_notes, internal_notes, template_id",
      )
      .eq("id", parsed.data.source_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (srcErr) return err(srcErr.code ?? "db_error", srcErr.message);
    if (!source) return err("not_found", "Source quote not found");

    const { data: lines, error: linesErr } = await supabase
      .from("quote_lines")
      .select(
        "part_id, qty, unit_price, line_notes_internal, line_notes_customer, position",
      )
      .eq("quote_id", parsed.data.source_id)
      .order("position", { ascending: true });
    if (linesErr) return err(linesErr.code ?? "db_error", linesErr.message);

    // New quote: always draft, validity blank (Jim picks fresh), no sent_at.
    const { data: newQuote, error: insErr } = await supabase
      .from("quotes")
      .insert({
        customer_id: source.customer_id,
        status: "draft",
        validity_date: null,
        customer_notes: source.customer_notes,
        internal_notes: source.internal_notes,
        template_id: source.template_id,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (insErr) return err(insErr.code ?? "db_error", insErr.message);

    // Copy lines but drop ai_suggested_price / override_reason so the new
    // quote gets fresh suggestions next time the user runs them.
    if (lines && lines.length > 0) {
      const payload = lines.map((l) => ({
        quote_id: newQuote.id,
        part_id: l.part_id,
        qty: l.qty,
        unit_price: l.unit_price,
        line_notes_internal: l.line_notes_internal,
        line_notes_customer: l.line_notes_customer,
        position: l.position,
        created_by: userId,
        updated_by: userId,
      }));
      const { error: linesInsErr } = await supabase
        .from("quote_lines")
        .insert(payload);
      if (linesInsErr)
        return err(linesInsErr.code ?? "db_error", linesInsErr.message);
    }

    revalidatePath("/quotes");
    revalidatePath(`/customers/${source.customer_id}`);
    return ok({ id: newQuote.id });
  } catch (e) {
    return fromException(e);
  }
}

export async function duplicateQuoteAndRedirect(
  input: z.input<typeof DuplicateQuoteSchema>,
) {
  const result = await duplicateQuote(input);
  if (result.ok) redirect(`/quotes/${result.data.id}`);
  return result;
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

const SuggestPriceSchema = z.object({
  line_id: z.string().uuid(),
  quote_id: z.string().uuid(),
});

export async function suggestPriceForLine(
  input: z.input<typeof SuggestPriceSchema>,
): Promise<
  ActionResult<{
    suggested_price: number;
    confidence: number;
    reasoning: string;
  }>
> {
  const parsed = SuggestPriceSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const { suggestPrice } = await import("@/lib/pricing/suggest");
    const userId = await getCurrentUserId();

    const { data: line, error: lineErr } = await supabase
      .from("quote_lines")
      .select("part_id, qty, quotes!inner(customer_id)")
      .eq("id", parsed.data.line_id)
      .maybeSingle();
    if (lineErr) return err(lineErr.code ?? "db_error", lineErr.message);
    if (!line) return err("not_found", "Quote line not found");

    type Row = { part_id: string | null; qty: number; quotes: { customer_id: string } };
    const row = line as unknown as Row;
    if (!row.part_id) {
      return err("validation", "Line has no part — pick one before suggesting a price");
    }

    const suggestion = await suggestPrice({
      part_id: row.part_id,
      qty: row.qty,
      customer_id: row.quotes.customer_id,
    });

    const { error: updErr } = await supabase
      .from("quote_lines")
      .update({
        ai_suggested_price: suggestion.suggested_price,
        ai_reasoning: suggestion.reasoning,
        updated_by: userId,
      })
      .eq("id", parsed.data.line_id);
    if (updErr) return err(updErr.code ?? "db_error", updErr.message);

    revalidatePath(`/quotes/${parsed.data.quote_id}`);
    return ok(suggestion);
  } catch (e) {
    return fromException(e);
  }
}

const AddAttachmentSchema = z.object({
  quote_id: z.string().uuid(),
  drive_file_id: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  mime_type: z.string().max(200).nullable(),
});

export async function addQuoteAttachment(
  input: z.input<typeof AddAttachmentSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AddAttachmentSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("quote_attachments")
      .insert({
        quote_id: parsed.data.quote_id,
        drive_file_id: parsed.data.drive_file_id,
        name: parsed.data.name,
        mime_type: parsed.data.mime_type,
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

export async function deleteQuoteAttachment({
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
      .from("quote_attachments")
      .delete()
      .eq("id", id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/quotes/${quote_id}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

const ShareQuoteSchema = z.object({ id: z.string().uuid() });

export async function generatePublicLink(
  input: z.input<typeof ShareQuoteSchema>,
): Promise<ActionResult<{ token: string }>> {
  const parsed = ShareQuoteSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    // Generate fresh token (regenerates if one already exists, revoking the
    // old link).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tokenResp, error: tokenErr } = await (supabase.rpc as any)(
      "gen_quote_public_token",
    );
    if (tokenErr) return err(tokenErr.code ?? "db_error", tokenErr.message);
    const token = tokenResp as string;
    const { error } = await supabase
      .from("quotes")
      .update({
        public_token: token,
        public_shared_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", parsed.data.id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/quotes/${parsed.data.id}`);
    return ok({ token });
  } catch (e) {
    return fromException(e);
  }
}

export async function revokePublicLink(
  input: z.input<typeof ShareQuoteSchema>,
): Promise<ActionResult<void>> {
  const parsed = ShareQuoteSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("quotes")
      .update({
        public_token: null,
        public_shared_at: null,
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

// One-shot draft creation: quote header + all lines in a single round-trip.
// Used by /quotes/new (full-page builder). If creating without lines just call
// createQuote() above.

const NewQuoteLineSchema = z.object({
  // Either part_id (linked) or description (free-text). At least one required.
  part_id: z.string().uuid().nullable(),
  description: z.string().trim().max(2000).nullable(),
  qty: z.coerce.number().min(0).max(1_000_000),
  unit_price: z.coerce.number().min(0).max(1_000_000).nullable(),
});

const CreateQuoteWithLinesSchema = z.object({
  customer_id: z.string().uuid(),
  validity_date: z.string().date().optional().nullable(),
  customer_notes: z.string().trim().max(4000).optional().nullable(),
  internal_notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(NewQuoteLineSchema).max(200),
});

export async function createQuoteWithLines(
  input: z.input<typeof CreateQuoteWithLinesSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateQuoteWithLinesSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();

    const { data: template } = await supabase
      .from("pdf_templates")
      .select("id")
      .eq("is_default", true)
      .maybeSingle();

    const validity =
      parsed.data.validity_date ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .insert({
        customer_id: parsed.data.customer_id,
        validity_date: validity,
        customer_notes: parsed.data.customer_notes ?? null,
        internal_notes: parsed.data.internal_notes ?? null,
        status: "draft",
        template_id: template?.id ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (qErr) return err(qErr.code ?? "db_error", qErr.message);

    const nonEmpty = parsed.data.lines.filter(
      (l) => l.part_id || (l.description && l.description.trim()),
    );
    if (nonEmpty.length > 0) {
      const linesPayload = nonEmpty.map((l, idx) => ({
        quote_id: quote.id,
        part_id: l.part_id,
        qty: l.qty,
        unit_price: l.unit_price,
        // Free-text descriptions land in line_notes_customer so they print
        // on the PDF. If a part is linked, the PDF uses the part description
        // and this stays as a per-line annotation.
        line_notes_customer: l.description ?? null,
        position: idx + 1,
        created_by: userId,
        updated_by: userId,
      }));
      const { error: lErr } = await supabase
        .from("quote_lines")
        .insert(linesPayload);
      if (lErr) return err(lErr.code ?? "db_error", lErr.message);
    }

    revalidatePath("/quotes");
    revalidatePath(`/customers/${parsed.data.customer_id}`);
    return ok({ id: quote.id });
  } catch (e) {
    return fromException(e);
  }
}

// AI extraction for the new-quote builder. Takes pasted text or a voice
// transcript and returns a draft quote: customer hint, validity, notes, and
// any line items it can pull out. Runs on Sonnet — line extraction benefits
// from the larger model.

const QUOTE_EXTRACT_TOOL = {
  name: "extract_quote_draft",
  description:
    "Structured draft of a quote parsed from free text or a voice transcript.",
  input_schema: {
    type: "object",
    properties: {
      customer_name: { type: ["string", "null"] },
      customer_email: { type: ["string", "null"] },
      validity_date: {
        type: ["string", "null"],
        description: "YYYY-MM-DD if a deadline / expiry is mentioned",
      },
      customer_notes: {
        type: ["string", "null"],
        description: "Brief note visible to customer (terms, freight, etc.)",
      },
      internal_notes: {
        type: ["string", "null"],
        description: "Internal-only note (won't print on the PDF)",
      },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            part_number_guess: { type: ["string", "null"] },
            qty: { type: ["number", "null"] },
            unit_price: { type: ["number", "null"] },
          },
          required: ["description", "part_number_guess", "qty", "unit_price"],
        },
      },
    },
    required: [
      "customer_name",
      "customer_email",
      "validity_date",
      "customer_notes",
      "internal_notes",
      "lines",
    ],
  },
} as const;

const QUOTE_EXTRACT_SYSTEM = `You parse short notes, RFQ emails, or voice transcripts into a draft quote for CAP Hardware Supply.

Rules:
- Output ONLY via the extract_quote_draft tool. No prose.
- customer_name: the buying company, if stated. Else null.
- customer_email: any email address found.
- validity_date: ISO YYYY-MM-DD if a deadline is mentioned (e.g. "needed by Friday" → next Friday). Else null.
- customer_notes: terms / freight / notes that should appear on the PDF.
- internal_notes: anything we'd write to ourselves (not shown to customer).
- lines: each line item the user wants quoted. Set qty to null if unclear. Set unit_price to null unless the source explicitly states our selling price. part_number_guess: any PN-shaped token (manufacturer PN, internal PN, vendor SKU); null if the line is described in plain English.
- description: a verbatim, customer-facing description of the item (drop the qty number from this string).
- Do NOT invent part numbers, prices, or quantities. Use null aggressively.`;

const ExtractedQuoteSchema = z.object({
  customer_name: z.string().nullable(),
  customer_email: z.string().nullable(),
  validity_date: z.string().nullable(),
  customer_notes: z.string().nullable(),
  internal_notes: z.string().nullable(),
  lines: z.array(
    z.object({
      description: z.string(),
      part_number_guess: z.string().nullable(),
      qty: z.number().nullable(),
      unit_price: z.number().nullable(),
    }),
  ),
});

export type ExtractedQuote = z.infer<typeof ExtractedQuoteSchema>;

export async function extractQuoteFromText(
  text: string,
): Promise<ActionResult<ExtractedQuote>> {
  const t = text.trim();
  if (!t) return err("validation", "Paste or speak something first");
  if (t.length > 12_000) {
    return err("validation", "Too long — keep under 12,000 characters");
  }

  try {
    const client = getAnthropic();
    const response = await client.messages.create({
      model: MODELS.extraction, // Sonnet — line extraction wants the better model
      max_tokens: 4096,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [QUOTE_EXTRACT_TOOL as any],
      tool_choice: { type: "tool", name: QUOTE_EXTRACT_TOOL.name },
      system: [
        {
          type: "text",
          text: QUOTE_EXTRACT_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: t }],
    });

    const toolUse = response.content.find(
      (c): c is Extract<typeof c, { type: "tool_use" }> =>
        c.type === "tool_use",
    );
    if (!toolUse) return err("llm_error", "Could not extract — try again");

    const parsed = ExtractedQuoteSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return err("llm_error", "Got an unexpected response shape");
    }
    return ok(parsed.data);
  } catch (e) {
    return fromException(e);
  }
}
