"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const ProfileSchema = z.object({
  full_name: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function updateProfile(
  input: z.input<typeof ProfileSchema>,
): Promise<ActionResult<void>> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: parsed.data.full_name?.trim() || null,
      },
    });
    if (error) return err("auth_error", error.message);
    revalidatePath("/", "layout");
    revalidatePath("/settings/profile");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

const PasswordSchema = z
  .object({
    new_password: z.string().min(8, "Use at least 8 characters").max(128),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

export async function changePassword(
  input: z.input<typeof PasswordSchema>,
): Promise<ActionResult<void>> {
  const parsed = PasswordSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.new_password,
    });
    if (error) return err("auth_error", error.message);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function signOutAllSessions(): Promise<ActionResult<void>> {
  try {
    const supabase = createClient();
    // 'global' revokes every refresh token for this user across all devices.
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) return err("auth_error", error.message);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}
