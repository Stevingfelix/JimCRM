"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const CreateCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
  billing_address: z.string().trim().max(500).optional().nullable(),
  primary_contact: z
    .object({
      name: z.string().trim().max(120).nullable(),
      email: z
        .union([z.literal(""), z.string().email("Invalid email")])
        .nullable()
        .transform((v) => (v === "" ? null : v)),
      phone: z.string().trim().max(60).nullable(),
      role: z.string().trim().max(80).nullable(),
    })
    .optional()
    .nullable(),
});

export async function createCustomer(
  input: z.input<typeof CreateCustomerSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", parsed.error.issues[0].message);
  }
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: parsed.data.name,
        notes: parsed.data.notes ?? null,
        billing_address: parsed.data.billing_address ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);

    // If primary contact info was provided, insert the first contact row.
    const pc = parsed.data.primary_contact;
    if (
      pc &&
      (pc.name?.trim() || pc.email?.trim() || pc.phone?.trim() || pc.role?.trim())
    ) {
      await supabase.from("customer_contacts").insert({
        customer_id: data.id,
        name: pc.name?.trim() || null,
        email: pc.email,
        phone: pc.phone?.trim() || null,
        role: pc.role?.trim() || null,
        created_by: userId,
        updated_by: userId,
      });
    }

    revalidatePath("/customers");
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

const UpdateCustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).nullable(),
  markup_multiplier: z.coerce.number().min(0.5).max(5).default(1),
  discount_pct: z.coerce.number().min(0).max(50).default(0),
  pricing_notes: z.string().trim().max(2000).nullable(),
});

export async function updateCustomer(
  input: z.input<typeof UpdateCustomerSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", parsed.error.issues[0].message);
  }
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("customers")
      .update({
        name: parsed.data.name,
        notes: parsed.data.notes,
        markup_multiplier: parsed.data.markup_multiplier,
        discount_pct: parsed.data.discount_pct,
        pricing_notes: parsed.data.pricing_notes,
        updated_by: userId,
      })
      .eq("id", parsed.data.id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/customers/${parsed.data.id}`);
    revalidatePath("/customers");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

const ContactInputSchema = z.object({
  customer_id: z.string().uuid(),
  name: z.string().trim().max(120).nullable(),
  email: z
    .union([z.literal(""), z.string().email("Invalid email")])
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  phone: z.string().trim().max(60).nullable(),
  role: z.string().trim().max(80).nullable(),
});

export async function addContact(
  input: z.input<typeof ContactInputSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = ContactInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", parsed.error.issues[0].message);
  }
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("customer_contacts")
      .insert({
        customer_id: parsed.data.customer_id,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        role: parsed.data.role,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/customers/${parsed.data.customer_id}`);
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

const UpdateContactSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  name: z.string().trim().max(120).nullable(),
  email: z
    .union([z.literal(""), z.string().email("Invalid email")])
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  phone: z.string().trim().max(60).nullable(),
  role: z.string().trim().max(80).nullable(),
});

export async function updateContact(
  input: z.input<typeof UpdateContactSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateContactSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", parsed.error.issues[0].message);
  }
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("customer_contacts")
      .update({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        role: parsed.data.role,
        updated_by: userId,
      })
      .eq("id", parsed.data.id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/customers/${parsed.data.customer_id}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function deleteContact({
  id,
  customer_id,
}: {
  id: string;
  customer_id: string;
}): Promise<ActionResult<void>> {
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(customer_id).success
  ) {
    return err("validation", "Invalid id");
  }
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("customer_contacts")
      .delete()
      .eq("id", id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/customers/${customer_id}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

// AI extraction from free text or voice transcript. Uses Haiku (cheap) since
// it's a small structured-output job. Returns whatever fields the model can
// confidently identify; nulls for the rest.

const CUSTOMER_EXTRACT_TOOL = {
  name: "extract_customer",
  description: "Structured customer contact details parsed from free text.",
  input_schema: {
    type: "object",
    properties: {
      company_name: { type: ["string", "null"] },
      contact_name: { type: ["string", "null"] },
      contact_email: { type: ["string", "null"] },
      contact_phone: { type: ["string", "null"] },
      billing_address: { type: ["string", "null"] },
      notes: { type: ["string", "null"] },
    },
    required: [
      "company_name",
      "contact_name",
      "contact_email",
      "contact_phone",
      "billing_address",
      "notes",
    ],
  },
} as const;

const CUSTOMER_EXTRACT_SYSTEM = `You parse short notes, emails, voicemails, or transcripts and extract one customer's contact details.

Rules:
- Output ONLY via the extract_customer tool. No prose.
- Use null when a field isn't clearly stated. Do not invent values.
- company_name: the buying company (e.g. "Acme Hardware Group"). If only a person is named with no company, leave null.
- contact_name: the human person to talk to.
- contact_email: a valid email address present in the text.
- contact_phone: a phone number — keep digits and the leading country code if stated; strip extra punctuation.
- billing_address: a single free-text address block (lines separated by newlines).
- notes: any non-contact context worth keeping (terms, freight preference, etc.). Brief — one short sentence at most.`;

const ExtractedCustomerSchema = z.object({
  company_name: z.string().nullable(),
  contact_name: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  billing_address: z.string().nullable(),
  notes: z.string().nullable(),
});

export type ExtractedCustomer = z.infer<typeof ExtractedCustomerSchema>;

export async function extractCustomerFromText(
  text: string,
): Promise<ActionResult<ExtractedCustomer>> {
  const t = text.trim();
  if (!t) return err("validation", "Paste or speak something first");
  if (t.length > 4000) {
    return err("validation", "Too long — keep under 4000 characters");
  }

  try {
    const client = getAnthropic();
    const response = await client.messages.create({
      model: MODELS.classification, // Haiku — cheap, plenty for this
      max_tokens: 800,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [CUSTOMER_EXTRACT_TOOL as any],
      tool_choice: { type: "tool", name: CUSTOMER_EXTRACT_TOOL.name },
      system: [
        {
          type: "text",
          text: CUSTOMER_EXTRACT_SYSTEM,
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

    const parsed = ExtractedCustomerSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return err("llm_error", "Got an unexpected response shape");
    }
    return ok(parsed.data);
  } catch (e) {
    return fromException(e);
  }
}
