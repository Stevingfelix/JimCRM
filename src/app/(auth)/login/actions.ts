"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const PasswordSignInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export async function signInWithPassword(
  input: z.input<typeof PasswordSignInSchema>,
): Promise<ActionResult<void>> {
  const parsed = PasswordSignInSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) return err("auth", error.message);
  } catch (e) {
    return fromException(e);
  }
  redirect(parsed.data.next || "/");
}

const MagicLinkSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export async function sendMagicLink(
  input: z.input<typeof MagicLinkSchema>,
): Promise<ActionResult<void>> {
  const parsed = MagicLinkSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createClient();
    const origin = (await headers()).get("origin") ?? "http://localhost:3000";
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: false, // invite-only — no auto-creation
      },
    });
    if (error) return err("auth", error.message);
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function signInWithGoogle(): Promise<ActionResult<{ url: string }>> {
  try {
    const supabase = createClient();
    const origin = (await headers()).get("origin") ?? "http://localhost:3000";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) return err("auth", error.message);
    if (!data.url) return err("auth", "OAuth URL not returned");
    return ok({ url: data.url });
  } catch (e) {
    return fromException(e);
  }
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
