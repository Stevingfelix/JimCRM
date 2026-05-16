import type { SupabaseClient } from "@supabase/supabase-js";
import { REVIEW_CONFIDENCE_THRESHOLD, type ExtractedLine } from "./_pattern";

export type MatchedPart = {
  id: string;
  internal_pn: string;
  short_description: string | null;
} | null;

export type MatchSource =
  | "internal_pn_exact"
  | "alias_exact"
  | "internal_pn_ilike"
  | "alias_ilike"
  | "none";

export type EnrichedLine = ExtractedLine & {
  matched_part: MatchedPart;
  match_source: MatchSource;
  matched_alias: string | null;
  extraction_source?: string; // "email_body" | "pdf:<filename>" | "excel:<filename>"
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enrichLine(
  line: ExtractedLine,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public">,
): Promise<EnrichedLine> {
  const guess = line.part_number_guess?.trim();
  if (!guess) {
    return {
      ...line,
      matched_part: null,
      match_source: "none",
      matched_alias: null,
    };
  }

  // 1) Exact internal_pn
  const { data: exact } = await supabase
    .from("parts")
    .select("id, internal_pn, short_description")
    .eq("internal_pn", guess)
    .is("deleted_at", null)
    .maybeSingle();
  if (exact) {
    return {
      ...line,
      matched_part: exact,
      match_source: "internal_pn_exact",
      matched_alias: null,
    };
  }

  // 2) Exact alias
  const { data: aliasExact } = await supabase
    .from("part_aliases")
    .select("alias_pn, parts!inner(id, internal_pn, short_description)")
    .eq("alias_pn", guess)
    .limit(1)
    .maybeSingle();
  if (aliasExact) {
    type Row = {
      alias_pn: string;
      parts: { id: string; internal_pn: string; short_description: string | null };
    };
    const a = aliasExact as unknown as Row;
    return {
      ...line,
      matched_part: a.parts,
      match_source: "alias_exact",
      matched_alias: a.alias_pn,
    };
  }

  // 3) Fuzzy ILIKE (best-effort) — only used to flag a "probable" match for review.
  const like = `%${guess}%`;
  const [partsRes, aliasRes] = await Promise.all([
    supabase
      .from("parts")
      .select("id, internal_pn, short_description")
      .ilike("internal_pn", like)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("part_aliases")
      .select("alias_pn, parts!inner(id, internal_pn, short_description)")
      .ilike("alias_pn", like)
      .limit(1)
      .maybeSingle(),
  ]);

  if (partsRes.data) {
    return {
      ...line,
      matched_part: partsRes.data,
      match_source: "internal_pn_ilike",
      matched_alias: null,
    };
  }
  if (aliasRes.data) {
    type Row = {
      alias_pn: string;
      parts: { id: string; internal_pn: string; short_description: string | null };
    };
    const a = aliasRes.data as unknown as Row;
    return {
      ...line,
      matched_part: a.parts,
      match_source: "alias_ilike",
      matched_alias: a.alias_pn,
    };
  }

  return {
    ...line,
    matched_part: null,
    match_source: "none",
    matched_alias: null,
  };
}

export function lineNeedsReview(line: EnrichedLine): boolean {
  if (line.confidence < REVIEW_CONFIDENCE_THRESHOLD) return true;
  if (line.match_source === "none") return true;
  if (line.match_source === "internal_pn_ilike" || line.match_source === "alias_ilike") {
    // Fuzzy is good enough to suggest, never strong enough to auto-commit.
    return true;
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findCustomerByEmail(
  email: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public">,
): Promise<{ customer_id: string; customer_name: string } | null> {
  const { data } = await supabase
    .from("customer_contacts")
    .select("customer_id, customers!inner(name)")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  type Row = { customer_id: string; customers: { name: string } };
  const r = data as unknown as Row;
  return { customer_id: r.customer_id, customer_name: r.customers.name };
}
