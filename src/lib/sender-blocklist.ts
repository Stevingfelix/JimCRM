import { createAdminClient } from "@/lib/supabase/admin";

// Sender blocklist — populated when humans reject emails in the review
// queue. The poll cron consults this BEFORE calling Haiku triage so we
// avoid even the cheap classifier cost on repeat offenders.

export type BlockedSender = {
  sender_email: string;
  rejected_count: number;
  last_rejected_at: string;
};

const norm = (email: string): string => email.trim().toLowerCase();

export async function isSenderBlocked(
  email: string,
): Promise<BlockedSender | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("known_noise_senders")
    .select("sender_email, rejected_count, last_rejected_at")
    .eq("sender_email", norm(email))
    .maybeSingle();
  return data ?? null;
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

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Upsert pattern: try insert; if conflict, increment via update.
  // Postgres does not support upsert-with-increment in a single PostgREST
  // call without RPC, so we do a two-step but keep it idempotent.
  const { error: insertErr } = await supabase
    .from("known_noise_senders")
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

  const { data: existing } = await supabase
    .from("known_noise_senders")
    .select("rejected_count")
    .eq("sender_email", normalized)
    .single();
  await supabase
    .from("known_noise_senders")
    .update({
      rejected_count: (existing?.rejected_count ?? 1) + 1,
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

export type BlockedSenderRow = {
  sender_email: string;
  first_rejected_at: string;
  last_rejected_at: string;
  rejected_count: number;
};

export async function listBlockedSenders(): Promise<BlockedSenderRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("known_noise_senders")
    .select("sender_email, first_rejected_at, last_rejected_at, rejected_count")
    .order("last_rejected_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function unblockSender(email: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("known_noise_senders")
    .delete()
    .eq("sender_email", norm(email));
  if (error) throw new Error(error.message);
}
