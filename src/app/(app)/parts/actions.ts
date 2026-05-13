"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const CreatePartSchema = z.object({
  internal_pn: z.string().trim().min(1, "Internal PN is required").max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  internal_notes: z.string().trim().max(2000).optional().nullable(),
});

export type CreatePartInput = z.infer<typeof CreatePartSchema>;

export async function createPart(
  input: CreatePartInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreatePartSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", parsed.error.issues[0].message);
  }

  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("parts")
      .insert({
        internal_pn: parsed.data.internal_pn,
        description: parsed.data.description ?? null,
        internal_notes: parsed.data.internal_notes ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return err("duplicate", `Internal PN "${parsed.data.internal_pn}" already exists`);
      }
      return err(error.code ?? "db_error", error.message);
    }

    revalidatePath("/parts");
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

export async function createPartAndRedirect(input: CreatePartInput) {
  const result = await createPart(input);
  if (result.ok) {
    redirect(`/parts/${result.data.id}`);
  }
  return result;
}
