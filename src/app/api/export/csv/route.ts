import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatQuoteNumber } from "@/lib/format";

// ERP-import CSV. Schema is a sensible default until Jim provides his actual
// ERP column spec; swap column names + ordering here to match without
// touching anything else. See specs/MVP_BRIEF.md §2.4.
const COLUMNS = [
  "quote_number",
  "customer_name",
  "customer_id",
  "status",
  "quote_created_at",
  "quote_sent_at",
  "validity_date",
  "line_position",
  "internal_pn",
  "description",
  "qty",
  "unit_price",
  "line_total",
] as const;

type Filters = {
  quote_id?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
  new_parts_only?: boolean;
};

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const filters: Filters = {
    quote_id: url.searchParams.get("quote_id") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    new_parts_only: url.searchParams.get("new_parts_only") === "1",
  };

  try {
    const supabase = createAdminClient();

    let query = supabase
      .from("quotes")
      .select(
        "id, quote_number, status, validity_date, created_at, sent_at, customer_id, customers!inner(name), quote_lines(position, qty, unit_price, parts(internal_pn, description, created_at))",
      )
      .is("deleted_at", null);

    if (filters.quote_id) query = query.eq("id", filters.quote_id);
    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lte("created_at", filters.to);

    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      quote_number: number;
      status: string;
      validity_date: string | null;
      created_at: string;
      sent_at: string | null;
      customer_id: string;
      customers: { name: string };
      quote_lines: Array<{
        position: number;
        qty: number;
        unit_price: number | null;
        parts: {
          internal_pn: string;
          description: string | null;
          created_at: string;
        } | null;
      }>;
    };

    const rows: string[] = [];
    rows.push(COLUMNS.join(","));

    const cutoff = filters.new_parts_only
      ? // "new parts" = parts whose first quote line is in this export window
        new Date(filters.from ?? "1970-01-01")
      : null;

    for (const q of (data ?? []) as unknown as Row[]) {
      const lines = [...q.quote_lines].sort((a, b) => a.position - b.position);
      for (const l of lines) {
        if (
          filters.new_parts_only &&
          l.parts &&
          cutoff &&
          new Date(l.parts.created_at) < cutoff
        ) {
          continue;
        }
        const lineTotal =
          l.unit_price != null ? (l.qty * l.unit_price).toFixed(4) : "";
        rows.push(
          [
            formatQuoteNumber(q.quote_number),
            q.customers.name,
            q.customer_id,
            q.status,
            q.created_at,
            q.sent_at ?? "",
            q.validity_date ?? "",
            l.position,
            l.parts?.internal_pn ?? "",
            l.parts?.description ?? "",
            l.qty,
            l.unit_price ?? "",
            lineTotal,
          ]
            .map(csvEscape)
            .join(","),
        );
      }
    }

    const body = rows.join("\n") + "\n";
    const filename = filters.quote_id
      ? `quote-${filters.quote_id.slice(0, 8)}.csv`
      : `erp-export-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
