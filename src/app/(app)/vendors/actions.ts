"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const CreateVendorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function createVendor(
  input: z.input<typeof CreateVendorSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateVendorSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("vendors")
      .insert({
        name: parsed.data.name,
        notes: parsed.data.notes ?? null,
        categories: [],
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath("/vendors");
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

const UpdateVendorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  categories: z.array(z.string().trim().min(1).max(80)).max(20),
  notes: z.string().trim().max(2000).nullable(),
});

export async function updateVendor(
  input: z.input<typeof UpdateVendorSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateVendorSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    // Dedupe + normalize categories.
    const normalized = Array.from(
      new Set(parsed.data.categories.map((c) => c.toLowerCase())),
    );
    const { error } = await supabase
      .from("vendors")
      .update({
        name: parsed.data.name,
        categories: normalized,
        notes: parsed.data.notes,
        updated_by: userId,
      })
      .eq("id", parsed.data.id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/vendors/${parsed.data.id}`);
    revalidatePath("/vendors");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

const ContactInputSchema = z.object({
  vendor_id: z.string().uuid(),
  name: z.string().trim().max(120).nullable(),
  email: z
    .union([z.literal(""), z.string().email("Invalid email")])
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  phone: z.string().trim().max(60).nullable(),
  role: z.string().trim().max(80).nullable(),
});

export async function addVendorContact(
  input: z.input<typeof ContactInputSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = ContactInputSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("vendor_contacts")
      .insert({
        vendor_id: parsed.data.vendor_id,
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
    revalidatePath(`/vendors/${parsed.data.vendor_id}`);
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

const UpdateContactSchema = ContactInputSchema.extend({
  id: z.string().uuid(),
});

export async function updateVendorContact(
  input: z.input<typeof UpdateContactSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateContactSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("vendor_contacts")
      .update({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        role: parsed.data.role,
        updated_by: userId,
      })
      .eq("id", parsed.data.id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/vendors/${parsed.data.vendor_id}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function deleteVendorContact({
  id,
  vendor_id,
}: {
  id: string;
  vendor_id: string;
}): Promise<ActionResult<void>> {
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(vendor_id).success
  ) {
    return err("validation", "Invalid id");
  }
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("vendor_contacts")
      .delete()
      .eq("id", id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/vendors/${vendor_id}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}
