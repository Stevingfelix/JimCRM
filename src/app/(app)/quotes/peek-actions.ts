"use server";

import { createClient } from "@/lib/supabase/server";

export type QuotePeek = {
  id: string;
  quote_number: number;
  customer_id: string;
  customer_name: string;
  status: "draft" | "sent" | "won" | "lost" | "expired";
  validity_date: string | null;
  sent_at: string | null;
  created_at: string;
  customer_notes: string | null;
  line_count: number;
  total: number | null;
  lines: Array<{
    position: number;
    qty: number;
    unit_price: number | null;
    part_internal_pn: string | null;
    part_description: string | null;
  }>;
};

// Lightweight read for the quotes-list drawer: just enough to summarize the
// quote without hauling vendor recs, attachments, audit log, etc. The full
// editor at /quotes/[id] still does that fetch.
export async function getQuotePeek(id: string): Promise<QuotePeek | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, customer_id, status, validity_date, sent_at, created_at, customer_notes, customers!inner(name), quote_lines(position, qty, unit_price, parts(internal_pn, description))",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  type Row = {
    id: string;
    quote_number: number;
    customer_id: string;
    status: QuotePeek["status"];
    validity_date: string | null;
    sent_at: string | null;
    created_at: string;
    customer_notes: string | null;
    customers: { name: string };
    quote_lines: Array<{
      position: number;
      qty: number;
      unit_price: number | null;
      parts: { internal_pn: string; description: string | null } | null;
    }>;
  };
  const q = data as unknown as Row;

  const sortedLines = [...q.quote_lines].sort(
    (a, b) => a.position - b.position,
  );
  const total = sortedLines.reduce<number | null>((acc, l) => {
    if (l.unit_price == null) return acc;
    return (acc ?? 0) + l.qty * l.unit_price;
  }, null);

  return {
    id: q.id,
    quote_number: q.quote_number,
    customer_id: q.customer_id,
    customer_name: q.customers.name,
    status: q.status,
    validity_date: q.validity_date,
    sent_at: q.sent_at,
    created_at: q.created_at,
    customer_notes: q.customer_notes,
    line_count: sortedLines.length,
    total,
    lines: sortedLines.slice(0, 8).map((l) => ({
      position: l.position,
      qty: l.qty,
      unit_price: l.unit_price,
      part_internal_pn: l.parts?.internal_pn ?? null,
      part_description: l.parts?.description ?? null,
    })),
  };
}
