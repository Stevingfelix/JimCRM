"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const ALIAS_SOURCES = ["customer", "manufacturer", "vendor", "other"] as const;

const UpdatePartSchema = z.object({
  id: z.string().uuid(),
  internal_pn: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable(),
  internal_notes: z.string().trim().max(2000).nullable(),
});

export async function updatePart(
  input: z.input<typeof UpdatePartSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdatePartSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", parsed.error.issues[0].message);
  }

  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("parts")
      .update({
        internal_pn: parsed.data.internal_pn,
        description: parsed.data.description,
        internal_notes: parsed.data.internal_notes,
        updated_by: userId,
      })
      .eq("id", parsed.data.id);

    if (error) {
      if (error.code === "23505") {
        return err(
          "duplicate",
          `Internal PN "${parsed.data.internal_pn}" already exists`,
        );
      }
      return err(error.code ?? "db_error", error.message);
    }

    revalidatePath(`/parts/${parsed.data.id}`);
    revalidatePath("/parts");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function softDeletePart(id: string): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(id).success) {
    return err("validation", "Invalid part id");
  }
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("parts")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq("id", id);
    if (error) return err(error.code ?? "db_error", error.message);
  } catch (e) {
    return fromException(e);
  }
  revalidatePath("/parts");
  redirect("/parts");
}

const AliasInputSchema = z.object({
  part_id: z.string().uuid(),
  alias_pn: z.string().trim().min(1, "Alias PN is required").max(120),
  source_type: z.enum(ALIAS_SOURCES).nullable(),
  source_name: z.string().trim().max(120).nullable(),
});

export async function addAlias(
  input: z.input<typeof AliasInputSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AliasInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", parsed.error.issues[0].message);
  }
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("part_aliases")
      .insert({
        part_id: parsed.data.part_id,
        alias_pn: parsed.data.alias_pn,
        source_type: parsed.data.source_type,
        source_name: parsed.data.source_name,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/parts/${parsed.data.part_id}`);
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

const UpdateAliasSchema = z.object({
  id: z.string().uuid(),
  part_id: z.string().uuid(),
  alias_pn: z.string().trim().min(1).max(120),
  source_type: z.enum(ALIAS_SOURCES).nullable(),
  source_name: z.string().trim().max(120).nullable(),
});

export async function updateAlias(
  input: z.input<typeof UpdateAliasSchema>,
): Promise<ActionResult<void>> {
  const parsed = UpdateAliasSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", parsed.error.issues[0].message);
  }
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from("part_aliases")
      .update({
        alias_pn: parsed.data.alias_pn,
        source_type: parsed.data.source_type,
        source_name: parsed.data.source_name,
        updated_by: userId,
      })
      .eq("id", parsed.data.id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/parts/${parsed.data.part_id}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function deleteAlias({
  id,
  part_id,
}: {
  id: string;
  part_id: string;
}): Promise<ActionResult<void>> {
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(part_id).success
  ) {
    return err("validation", "Invalid id");
  }
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("part_aliases")
      .delete()
      .eq("id", id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath(`/parts/${part_id}`);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}
