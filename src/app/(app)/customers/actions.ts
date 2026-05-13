"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const CreateCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
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
