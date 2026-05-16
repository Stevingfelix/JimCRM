"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const CreatePartSchema = z.object({
  internal_pn: z.string().trim().min(1, "SKU is required").max(120),
  short_description: z.string().trim().max(200).optional().nullable(),
  long_description: z.string().trim().max(5000).optional().nullable(),
  internal_notes: z.string().trim().max(2000).optional().nullable(),
  thread_size: z.string().trim().max(120).optional().nullable(),
  length: z.string().trim().max(120).optional().nullable(),
  material: z.string().trim().max(120).optional().nullable(),
  finish: z.string().trim().max(120).optional().nullable(),
  grade: z.string().trim().max(120).optional().nullable(),
  head_type: z.string().trim().max(120).optional().nullable(),
  product_family: z.string().trim().max(120).optional().nullable(),
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
        short_description: parsed.data.short_description ?? null,
        long_description: parsed.data.long_description ?? null,
        internal_notes: parsed.data.internal_notes ?? null,
        thread_size: parsed.data.thread_size ?? null,
        length: parsed.data.length ?? null,
        material: parsed.data.material ?? null,
        finish: parsed.data.finish ?? null,
        grade: parsed.data.grade ?? null,
        head_type: parsed.data.head_type ?? null,
        product_family: parsed.data.product_family ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return err("duplicate", `SKU "${parsed.data.internal_pn}" already exists`);
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

// One-shot helper for the review queue: when an inbound RFQ line uses an
// external PN (mil-spec, NAS, vendor catalog, etc.) that doesn't match any
// existing CAP part, Jim can create the CAP part AND register the external
// PN as an alias in a single call. Returns the new part's id so the
// review row can immediately link to it.

const CreatePartWithAliasSchema = z.object({
  internal_pn: z.string().trim().min(1, "SKU is required").max(120),
  short_description: z.string().trim().max(1000).optional().nullable(),
  alias_pn: z.string().trim().min(1, "Alias is required").max(120),
  alias_source_type: z
    .enum(["customer", "manufacturer", "vendor", "other"])
    .default("customer"),
  alias_source_name: z.string().trim().max(120).optional().nullable(),
  thread_size: z.string().trim().max(120).optional().nullable(),
  length: z.string().trim().max(120).optional().nullable(),
  material: z.string().trim().max(120).optional().nullable(),
  finish: z.string().trim().max(120).optional().nullable(),
  grade: z.string().trim().max(120).optional().nullable(),
  head_type: z.string().trim().max(120).optional().nullable(),
  product_family: z.string().trim().max(120).optional().nullable(),
});

export async function createPartWithAlias(
  input: z.input<typeof CreatePartWithAliasSchema>,
): Promise<ActionResult<{ id: string; internal_pn: string }>> {
  const parsed = CreatePartWithAliasSchema.safeParse(input);
  if (!parsed.success) {
    return err("validation", parsed.error.issues[0].message);
  }
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId();

    const { data: part, error: partErr } = await supabase
      .from("parts")
      .insert({
        internal_pn: parsed.data.internal_pn,
        short_description: parsed.data.short_description ?? null,
        thread_size: parsed.data.thread_size ?? null,
        length: parsed.data.length ?? null,
        material: parsed.data.material ?? null,
        finish: parsed.data.finish ?? null,
        grade: parsed.data.grade ?? null,
        head_type: parsed.data.head_type ?? null,
        product_family: parsed.data.product_family ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("id, internal_pn")
      .single();
    if (partErr) {
      if (partErr.code === "23505") {
        return err(
          "duplicate",
          `SKU "${parsed.data.internal_pn}" already exists — search for it instead.`,
        );
      }
      return err(partErr.code ?? "db_error", partErr.message);
    }

    const { error: aliasErr } = await supabase.from("part_aliases").insert({
      part_id: part.id,
      alias_pn: parsed.data.alias_pn,
      source_type: parsed.data.alias_source_type,
      source_name: parsed.data.alias_source_name ?? null,
      created_by: userId,
      updated_by: userId,
    });
    // If the alias insert fails, keep the part — Jim can add aliases later.
    // Surface the error in the result so the UI can warn.
    if (aliasErr) {
      return err(
        "alias_failed",
        `Part created but alias couldn't be added: ${aliasErr.message}`,
      );
    }

    revalidatePath("/parts");
    return ok({ id: part.id, internal_pn: part.internal_pn });
  } catch (e) {
    return fromException(e);
  }
}
