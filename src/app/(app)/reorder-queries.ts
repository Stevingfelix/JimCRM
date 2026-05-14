import { createClient } from "@/lib/supabase/server";

export type ReorderHint = {
  customer_id: string;
  customer_name: string;
  part_id: string;
  internal_pn: string;
  description: string | null;
  last_quote_at: string;
  avg_interval_days: number;
  days_since_last: number;
  overdue_days: number;
};

// Looks for (customer, part) pairs that have been quoted ≥3 times so we have
// a sense of cadence, then surfaces those where the gap since last order is
// >=120% of the average gap. Pure SQL would be cleaner but doing it in-app
// avoids needing a Postgres function migration.
export async function getReorderHints(limit = 8): Promise<ReorderHint[]> {
  const supabase = createClient();

  // Pull every (customer, part) quote-line pair with the quote's created_at.
  // Cap at 5000 for sanity — realistic Jim won't exceed this in a couple years.
  const { data, error } = await supabase
    .from("quote_lines")
    .select(
      "part_id, created_at, parts!inner(id, internal_pn, description), quotes!inner(customer_id, customers!inner(id, name), status, deleted_at)",
    )
    .not("part_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return [];

  type Row = {
    part_id: string | null;
    created_at: string;
    parts: { id: string; internal_pn: string; description: string | null };
    quotes: {
      customer_id: string;
      customers: { id: string; name: string };
      status: string;
      deleted_at: string | null;
    };
  };

  // Group dates by (customer_id, part_id) — only count won quotes as "orders"
  // so the cadence is a real fulfillment signal, not a quote-firing signal.
  // If no wins exist for a pair, fall back to sent quotes.
  type Key = string;
  const wins: Record<Key, string[]> = {};
  const sents: Record<Key, string[]> = {};
  const meta: Record<
    Key,
    {
      customer_id: string;
      customer_name: string;
      part_id: string;
      internal_pn: string;
      description: string | null;
    }
  > = {};

  for (const row of (data ?? []) as unknown as Row[]) {
    if (row.quotes.deleted_at) continue;
    if (!row.part_id) continue;
    const key = `${row.quotes.customer_id}::${row.part_id}`;
    if (!meta[key]) {
      meta[key] = {
        customer_id: row.quotes.customer_id,
        customer_name: row.quotes.customers.name,
        part_id: row.part_id,
        internal_pn: row.parts.internal_pn,
        description: row.parts.description,
      };
    }
    if (row.quotes.status === "won") {
      (wins[key] ??= []).push(row.created_at);
    } else if (row.quotes.status === "sent") {
      (sents[key] ??= []).push(row.created_at);
    }
  }

  const hints: ReorderHint[] = [];
  for (const key of Object.keys(meta)) {
    const dates = (wins[key]?.length ?? 0) >= 3 ? wins[key] : sents[key] ?? [];
    if (dates.length < 3) continue;
    const sorted = dates
      .map((d) => Date.parse(d))
      .sort((a, b) => b - a); // newest first
    // Average interval between consecutive orders (in days).
    let totalDays = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      totalDays += (sorted[i] - sorted[i + 1]) / (1000 * 60 * 60 * 24);
    }
    const avg = totalDays / (sorted.length - 1);
    if (avg < 7) continue; // skip pairs ordering more than weekly — noise
    const daysSinceLast = (Date.now() - sorted[0]) / (1000 * 60 * 60 * 24);
    const overdue = daysSinceLast - avg;
    if (overdue > avg * 0.2) {
      hints.push({
        ...meta[key],
        last_quote_at: new Date(sorted[0]).toISOString(),
        avg_interval_days: Math.round(avg),
        days_since_last: Math.round(daysSinceLast),
        overdue_days: Math.round(overdue),
      });
    }
  }

  hints.sort((a, b) => b.overdue_days - a.overdue_days);
  return hints.slice(0, limit);
}
