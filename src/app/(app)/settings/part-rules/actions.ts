"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

// All four tables share the same code/label/display_order spine. We do
// minimal validation per table, soft-delete is just `delete` since the
// extractors read fresh on every call (no FK ties to other rows).

// ─── Families ──────────────────────────────────────────────────────────

const FamilySchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(8, "Family codes stay short (≤ 8 chars)")
    .regex(/^[A-Z0-9]+$/i, "Use letters / digits only")
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, "Name is required").max(80),
  requires_thread: z.boolean(),
  requires_length: z.boolean(),
  notes: z.string().trim().max(200).optional().or(z.literal("")),
  display_order: z.coerce.number().int().min(0).max(10_000).default(999),
});

export async function saveFamily(
  input: z.input<typeof FamilySchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = FamilySchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const payload = {
      code: parsed.data.code,
      name: parsed.data.name,
      requires_thread: parsed.data.requires_thread,
      requires_length: parsed.data.requires_length,
      notes: parsed.data.notes?.trim() || null,
      display_order: parsed.data.display_order,
      updated_by: userId,
    };
    if (parsed.data.id) {
      const { error } = await supabase
        .from("part_naming_families")
        .update(payload)
        .eq("id", parsed.data.id);
      if (error) return err(error.code ?? "db_error", error.message);
      bust();
      return ok({ id: parsed.data.id });
    }
    const { data, error } = await supabase
      .from("part_naming_families")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    bust();
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

export async function deleteFamily(id: string): Promise<ActionResult<void>> {
  return simpleDelete("part_naming_families", id);
}

// ─── Sizes ─────────────────────────────────────────────────────────────

const SizeSchema = z.object({
  id: z.string().uuid().optional(),
  system: z.enum(["imperial", "metric"]),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(8)
    .transform((s) => s),
  label: z.string().trim().min(1, "Label is required").max(20),
  diameter_inches: z.coerce
    .number()
    .min(0)
    .max(50)
    .optional()
    .nullable(),
  display_order: z.coerce.number().int().min(0).max(10_000).default(999),
});

export async function saveSize(
  input: z.input<typeof SizeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = SizeSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const payload = {
      system: parsed.data.system,
      code: parsed.data.code,
      label: parsed.data.label,
      diameter_inches: parsed.data.diameter_inches ?? null,
      display_order: parsed.data.display_order,
      updated_by: userId,
    };
    if (parsed.data.id) {
      const { error } = await supabase
        .from("part_naming_sizes")
        .update(payload)
        .eq("id", parsed.data.id);
      if (error) return err(error.code ?? "db_error", error.message);
      bust();
      return ok({ id: parsed.data.id });
    }
    const { data, error } = await supabase
      .from("part_naming_sizes")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    bust();
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

export async function deleteSize(id: string): Promise<ActionResult<void>> {
  return simpleDelete("part_naming_sizes", id);
}

// ─── Threads ───────────────────────────────────────────────────────────

const ThreadSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(4)
    .regex(/^[A-Z0-9]+$/i, "Use letters / digits only")
    .transform((s) => s.toUpperCase()),
  label: z.string().trim().min(1, "Label is required").max(40),
  display_order: z.coerce.number().int().min(0).max(10_000).default(999),
});

export async function saveThread(
  input: z.input<typeof ThreadSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = ThreadSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const payload = {
      code: parsed.data.code,
      label: parsed.data.label,
      display_order: parsed.data.display_order,
      updated_by: userId,
    };
    if (parsed.data.id) {
      const { error } = await supabase
        .from("part_naming_threads")
        .update(payload)
        .eq("id", parsed.data.id);
      if (error) return err(error.code ?? "db_error", error.message);
      bust();
      return ok({ id: parsed.data.id });
    }
    const { data, error } = await supabase
      .from("part_naming_threads")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    bust();
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

export async function deleteThread(id: string): Promise<ActionResult<void>> {
  return simpleDelete("part_naming_threads", id);
}

// ─── Attributes ────────────────────────────────────────────────────────

const AttributeSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(12)
    .transform((s) => s.toUpperCase()),
  label: z.string().trim().min(1, "Label is required").max(80),
  kind: z.enum(["grade", "finish", "material", "combo"]),
  display_order: z.coerce.number().int().min(0).max(10_000).default(999),
});

export async function saveAttribute(
  input: z.input<typeof AttributeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AttributeSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const payload = {
      code: parsed.data.code,
      label: parsed.data.label,
      kind: parsed.data.kind,
      display_order: parsed.data.display_order,
      updated_by: userId,
    };
    if (parsed.data.id) {
      const { error } = await supabase
        .from("part_naming_attributes")
        .update(payload)
        .eq("id", parsed.data.id);
      if (error) return err(error.code ?? "db_error", error.message);
      bust();
      return ok({ id: parsed.data.id });
    }
    const { data, error } = await supabase
      .from("part_naming_attributes")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    bust();
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

export async function deleteAttribute(id: string): Promise<ActionResult<void>> {
  return simpleDelete("part_naming_attributes", id);
}

// ─── Helpers ───────────────────────────────────────────────────────────

async function simpleDelete(
  table:
    | "part_naming_families"
    | "part_naming_sizes"
    | "part_naming_threads"
    | "part_naming_attributes",
  id: string,
): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(id).success) {
    return err("validation", "Invalid id");
  }
  try {
    const supabase = createClient();
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return err(error.code ?? "db_error", error.message);
    bust();
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

function bust() {
  // Invalidate both the unstable_cache tag (used by the extractor lib) and
  // the page that displays the editor.
  revalidateTag("part-naming");
  revalidatePath("/settings/part-rules");
}
