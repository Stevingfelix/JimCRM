"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const ProfileSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  is_default: z.boolean(),
  column_map: z.record(z.string(), z.string()),
  columns_order: z.array(z.string()).min(1),
});

export async function saveCsvProfile(
  input: z.input<typeof ProfileSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();

    // If marking this profile default, unset other defaults first.
    if (parsed.data.is_default) {
      await supabase
        .from("csv_export_profiles")
        .update({ is_default: false })
        .eq("is_default", true);
    }

    if (parsed.data.id) {
      const { error } = await supabase
        .from("csv_export_profiles")
        .update({
          name: parsed.data.name,
          is_default: parsed.data.is_default,
          column_map: parsed.data.column_map,
          columns_order: parsed.data.columns_order,
          updated_by: userId,
        })
        .eq("id", parsed.data.id);
      if (error) return err(error.code ?? "db_error", error.message);
      revalidatePath("/settings/exports");
      return ok({ id: parsed.data.id });
    }

    const { data, error } = await supabase
      .from("csv_export_profiles")
      .insert({
        name: parsed.data.name,
        is_default: parsed.data.is_default,
        column_map: parsed.data.column_map,
        columns_order: parsed.data.columns_order,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath("/settings/exports");
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

export async function deleteCsvProfile(id: string): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(id).success) {
    return err("validation", "Invalid id");
  }
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("csv_export_profiles")
      .delete()
      .eq("id", id);
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath("/settings/exports");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}
