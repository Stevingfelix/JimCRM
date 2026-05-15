import { createAdminClient } from "@/lib/supabase/admin";

// Sender blocklist — populated when humans reject emails in the review
// queue. The poll cron consults this BEFORE calling Haiku triage so we
// avoid even the cheap classifier cost on repeat offenders.

export type BlockedSender = {
  sender_email: string;
  rejected_count: number;
  last_rejected_at: string;
};

const TABLE = "known_noise_senders";

const norm = (email: string): string => email.trim().toLowerCase();

// The generated Database types don't yet know about known_noise_senders
// (migration 0024 ships with this PR). Regenerate types with
// `supabase gen types typescript --linked > src/lib/supabase/types.ts`
// after applying the migration and the casts below can be removed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawAdmin(): any {
  return createAdminClient();
}

export async function isSenderBlocked(
  email: string,
): Promise<BlockedSender | null> {
  const { data } = await rawAdmin()
    .from(TABLE)
    .select("sender_email, rejected_count, last_rejected_at")
    .eq("sender_email", norm(email))
    .maybeSingle();
  return (data as BlockedSender | null) ?? null;
}

// Upserts the sender into the blocklist, bumping rejected_count.
// Called from the review queue's reject actions. No-ops for emails with
// no sender_email (we can't blocklist what we can't identify).
export async function recordNoiseSender(
  email: string | null | undefined,
  userId: string | null,
): Promise<void> {
  if (!email) return;
  const normalized = norm(email);
  if (!normalized.includes("@")) return;

  const now = new Date().toISOString();

  // Upsert pattern: try insert; if conflict, increment via update.
  // Postgres does not support upsert-with-increment in a single PostgREST
  // call without RPC, so we do a two-step but keep it idempotent.
  const { error: insertErr } = await rawAdmin()
    .from(TABLE)
    .insert({
      sender_email: normalized,
      first_rejected_at: now,
      last_rejected_at: now,
      rejected_count: 1,
      updated_by: userId,
    });

  if (!insertErr) return;
  // 23505 = unique_violation: sender already on list, increment instead.
  if (insertErr.code !== "23505") throw new Error(insertErr.message);

  const { data: existing } = await rawAdmin()
    .from(TABLE)
    .select("rejected_count")
    .eq("sender_email", normalized)
    .single();
  await rawAdmin()
    .from(TABLE)
    .update({
      rejected_count: ((existing?.rejected_count as number) ?? 1) + 1,
      last_rejected_at: now,
      updated_by: userId,
    })
    .eq("sender_email", normalized);
}

// Bulk version — used by rejectReviewBulk. Best-effort; one failure
// doesn't block the others.
export async function recordNoiseSendersBulk(
  emails: Array<string | null | undefined>,
  userId: string | null,
): Promise<void> {
  const unique = Array.from(
    new Set(
      emails
        .filter((e): e is string => !!e)
        .map(norm)
        .filter((e) => e.includes("@")),
    ),
  );
  for (const email of unique) {
    try {
      await recordNoiseSender(email, userId);
    } catch {
      // swallow — one bad sender shouldn't block the rest
    }
  }
}
