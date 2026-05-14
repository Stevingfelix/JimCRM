"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/auth";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["admin", "user"]),
});

export async function inviteTeammate(
  input: z.input<typeof InviteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const admin = createAdminClient();
    const invitedBy = await getCurrentUserId();

    // If the user already exists in auth.users, just stamp the role + return —
    // no invite needed.
    const { data: existing } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const found = existing?.users.find(
      (u) => u.email?.toLowerCase() === parsed.data.email,
    );
    if (found) {
      await admin.auth.admin.updateUserById(found.id, {
        app_metadata: {
          ...(found.app_metadata ?? {}),
          role: parsed.data.role,
        },
      });
      revalidatePath("/settings/team");
      return ok({ id: found.id });
    }

    // Send the invite via Supabase. This emails a magic link + creates the
    // user row immediately (status confirmed at link click).
    const { error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
        data: { invited_role: parsed.data.role },
      });
    if (inviteErr && !/already.+registered/i.test(inviteErr.message)) {
      return err("auth_error", inviteErr.message);
    }

    // Upsert the pending invite record (so the team list shows it).
    const { data, error } = await admin
      .from("team_invites")
      .upsert(
        {
          email: parsed.data.email,
          role: parsed.data.role,
          status: "pending",
          invited_by: invitedBy,
          invited_at: new Date().toISOString(),
          accepted_at: null,
          accepted_user_id: null,
        },
        { onConflict: "email" },
      )
      .select("id")
      .single();

    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath("/settings/team");
    return ok({ id: data.id });
  } catch (e) {
    return fromException(e);
  }
}

const RoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "user"]),
});

export async function setUserRole(
  input: z.input<typeof RoleSchema>,
): Promise<ActionResult<void>> {
  const parsed = RoleSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const admin = createAdminClient();
    const { data: target } = await admin.auth.admin.getUserById(
      parsed.data.user_id,
    );
    if (!target?.user) return err("not_found", "User not found");
    const { error } = await admin.auth.admin.updateUserById(
      parsed.data.user_id,
      {
        app_metadata: {
          ...(target.user.app_metadata ?? {}),
          role: parsed.data.role,
        },
      },
    );
    if (error) return err("auth_error", error.message);
    revalidatePath("/settings/team");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function removeUser(
  user_id: string,
): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(user_id).success) {
    return err("validation", "Invalid id");
  }
  try {
    const admin = createAdminClient();
    const currentId = await getCurrentUserId();
    if (currentId === user_id) {
      return err("forbidden", "You can't remove yourself");
    }
    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) return err("auth_error", error.message);
    revalidatePath("/settings/team");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function revokeInvite(id: string): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(id).success) {
    return err("validation", "Invalid id");
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("team_invites")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("status", "pending");
    if (error) return err(error.code ?? "db_error", error.message);
    revalidatePath("/settings/team");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}

export async function resendInvite(id: string): Promise<ActionResult<void>> {
  if (!z.string().uuid().safeParse(id).success) {
    return err("validation", "Invalid id");
  }
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("team_invites")
      .select("email, role")
      .eq("id", id)
      .maybeSingle();
    if (!row) return err("not_found", "Invite not found");

    const { error } = await admin.auth.admin.inviteUserByEmail(row.email, {
      data: { invited_role: row.role },
    });
    if (error && !/already.+registered/i.test(error.message)) {
      return err("auth_error", error.message);
    }
    await admin
      .from("team_invites")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", id);
    revalidatePath("/settings/team");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}
