import { createAdminClient } from "@/lib/supabase/admin";

// Alias suggestions — captured at quote-commit time. When the human picks
// a part that the alias-lookup didn't auto-find from the raw_text, that
// signal is worth keeping: same raw_text → same part next time.
//
// We never auto-promote. Each suggestion shows up on /parts/[id] with
// Accept/Dismiss buttons. Accept writes a real row to part_aliases.

export type PendingSuggestion = {
  id: string;
  alias_pn: string;
  source_type: string | null;
  source_name: string | null;
  raw_text: string | null;
  reasoning: string | null;
  created_at: string;
};

const norm = (s: string): string => s.trim();
const lowerNorm = (s: string): string => norm(s).toLowerCase();

type RecordSuggestionInput = {
  partId: string;
  aliasPn: string;
  rawText: string | null;
  reasoning: string | null;
  sourceEventId: string | null;
  sourceType?: string | null;
  sourceName?: string | null;
  userId: string | null;
};

// Records a suggestion if (a) the alias_pn isn't already an existing alias
// on this part and (b) there's no pending suggestion for the same pairing.
// Returns true if a new suggestion was written, false if it was a no-op.
export async function recordAliasSuggestion(
  input: RecordSuggestionInput,
): Promise<boolean> {
  const aliasPn = norm(input.aliasPn);
  if (!aliasPn) return false;

  const supabase = createAdminClient();

  // (a) Skip if an existing alias on this part already matches (case-insensitive).
  const { data: existingAliases } = await supabase
    .from("part_aliases")
    .select("alias_pn")
    .eq("part_id", input.partId);
  const aliasLower = lowerNorm(aliasPn);
  if (
    existingAliases?.some(
      (a) => (a.alias_pn ?? "").toLowerCase() === aliasLower,
    )
  ) {
    return false;
  }

  // (b) Try insert; the partial unique index on (part_id, lower(alias_pn))
  // WHERE status='pending' will reject a duplicate pending suggestion.
  const { error } = await supabase.from("part_alias_suggestions").insert({
    part_id: input.partId,
    alias_pn: aliasPn,
    raw_text: input.rawText,
    reasoning: input.reasoning,
    source_event_id: input.sourceEventId,
    source_type: input.sourceType ?? null,
    source_name: input.sourceName ?? null,
    status: "pending",
    created_by: input.userId,
    updated_by: input.userId,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
  return !error;
}

export async function listPendingSuggestionsForPart(
  partId: string,
): Promise<PendingSuggestion[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("part_alias_suggestions")
    .select(
      "id, alias_pn, source_type, source_name, raw_text, reasoning, created_at",
    )
    .eq("part_id", partId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function countPendingSuggestionsByPart(): Promise<
  Map<string, number>
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("part_alias_suggestions")
    .select("part_id")
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.part_id, (counts.get(row.part_id) ?? 0) + 1);
  }
  return counts;
}

export async function acceptSuggestion(
  suggestionId: string,
  userId: string | null,
): Promise<void> {
  const supabase = createAdminClient();

  const { data: s, error: readErr } = await supabase
    .from("part_alias_suggestions")
    .select("part_id, alias_pn, source_type, source_name, status")
    .eq("id", suggestionId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!s) throw new Error("Suggestion not found");
  if (s.status !== "pending") throw new Error("Suggestion already resolved");

  // Promote to part_aliases. The (part_id, lower(alias_pn)) unique
  // constraint in part_aliases will reject duplicates; treat that as a
  // successful no-op (someone already added it manually).
  const { error: insertErr } = await supabase.from("part_aliases").insert({
    part_id: s.part_id,
    alias_pn: s.alias_pn,
    source_type: s.source_type,
    source_name: s.source_name,
    created_by: userId,
    updated_by: userId,
  });
  if (insertErr && insertErr.code !== "23505") {
    throw new Error(insertErr.message);
  }

  const { error: updateErr } = await supabase
    .from("part_alias_suggestions")
    .update({ status: "accepted", updated_by: userId })
    .eq("id", suggestionId);
  if (updateErr) throw new Error(updateErr.message);
}

export async function dismissSuggestion(
  suggestionId: string,
  userId: string | null,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("part_alias_suggestions")
    .update({ status: "dismissed", updated_by: userId })
    .eq("id", suggestionId);
  if (error) throw new Error(error.message);
}
