import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { TeamManager } from "./components/team-manager";

export const dynamic = "force-dynamic";

type Member = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  last_sign_in_at: string | null;
  created_at: string;
  is_self: boolean;
};

type Invite = {
  id: string;
  email: string;
  role: "admin" | "user";
  status: "pending";
  invited_at: string;
};

export default async function TeamPage() {
  const admin = createAdminClient();
  const me = await getCurrentUser();

  const [usersRes, invitesRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin
      .from("team_invites")
      .select("id, email, role, status, invited_at")
      .eq("status", "pending")
      .order("invited_at", { ascending: false }),
  ]);

  const members: Member[] = (usersRes.data?.users ?? []).map((u) => {
    const meta = (u.app_metadata ?? {}) as Record<string, unknown>;
    const userMeta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const role = (meta.role === "admin" ? "admin" : "user") as
      | "admin"
      | "user";
    const full_name =
      typeof userMeta.full_name === "string"
        ? (userMeta.full_name as string)
        : null;
    return {
      user_id: u.id,
      email: u.email ?? "(no email)",
      full_name,
      role,
      last_sign_in_at: u.last_sign_in_at ?? null,
      created_at: u.created_at,
      is_self: u.id === me?.id,
    };
  });

  // Hide invites whose email is already in members.
  const memberEmails = new Set(members.map((m) => m.email.toLowerCase()));
  const invites: Invite[] = (invitesRes.data ?? [])
    .filter((i) => !memberEmails.has(i.email.toLowerCase()))
    .map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role === "admin" ? "admin" : "user",
      status: "pending" as const,
      invited_at: i.invited_at,
    }));

  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div className="space-y-1">
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← back to Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Invite teammates to quote, review extractions, and manage parts.
          Admins can also change settings and invite others.
        </p>
      </div>

      <TeamManager members={members} invites={invites} />
    </div>
  );
}
