import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatQuoteNumber } from "@/lib/format";

// Default column set + order. Used when no profile is specified or the
// "default" profile exists with empty columns_order.
const DEFAULT_COLUMNS = [
  "quote_number",
  "customer_name",
  "customer_id",
  "status",
  "quote_created_at",
  "quote_sent_at",
  "validity_date",
  "line_position",
  "internal_pn",
  "short_description",
  "thread_size",
  "length",
  "material",
  "finish",
  "grade",
  "head_type",
  "product_family",
  "qty",
  "unit_price",
  "line_total",
] as const;

type ColumnKey = (typeof DEFAULT_COLUMNS)[number];

type Filters = {
  quote_id?: string;
  from?: string;
  to?: string;
  new_parts_only?: boolean;
  profile?: string;
};

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
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
    profile: url.searchParams.get("profile") ?? undefined,
  };

  try {
    const supabase = createAdminClient();

    // Resolve which profile to use.
    let columnMap: Record<string, string> = {};
    let columnsOrder: string[] = [...DEFAULT_COLUMNS];
    let profileName = "default";

    if (filters.profile) {
      const { data: profile } = await supabase
        .from("csv_export_profiles")
        .select("name, column_map, columns_order")
        .eq("name", filters.profile)
        .maybeSingle();
      if (profile) {
        profileName = profile.name;
        columnMap = (profile.column_map as Record<string, string>) ?? {};
        const ord = profile.columns_order ?? [];
        if (Array.isArray(ord) && ord.length > 0) columnsOrder = ord;
      }
    } else {
      // Fall back to the default profile if one is marked default.
      const { data: profile } = await supabase
        .from("csv_export_profiles")
        .select("name, column_map, columns_order")
        .eq("is_default", true)
        .maybeSingle();
      if (profile) {
        profileName = profile.name;
        columnMap = (profile.column_map as Record<string, string>) ?? {};
        const ord = profile.columns_order ?? [];
        if (Array.isArray(ord) && ord.length > 0) columnsOrder = ord;
      }
    }

    // Build the header line from columnsOrder + columnMap.
    const headerCells = columnsOrder.map((k) => columnMap[k] ?? k);

    let query = supabase
      .from("quotes")
      .select(
        "id, quote_number, status, validity_date, created_at, sent_at, customer_id, customers!inner(name), quote_lines(position, qty, unit_price, parts(internal_pn, short_description, thread_size, length, material, finish, grade, head_type, product_family, created_at))",
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
          short_description: string | null;
          thread_size: string | null;
          length: string | null;
          material: string | null;
          finish: string | null;
          grade: string | null;
          head_type: string | null;
          product_family: string | null;
          created_at: string;
        } | null;
      }>;
    };

    const rows: string[] = [];
    rows.push(headerCells.join(","));

    const cutoff = filters.new_parts_only
      ? new Date(filters.from ?? "1970-01-01")
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

        // Build per-column values from the key set.
        const values: Record<ColumnKey, string | number> = {
          quote_number: formatQuoteNumber(q.quote_number),
          customer_name: q.customers.name,
          customer_id: q.customer_id,
          status: q.status,
          quote_created_at: q.created_at,
          quote_sent_at: q.sent_at ?? "",
          validity_date: q.validity_date ?? "",
          line_position: l.position,
          internal_pn: l.parts?.internal_pn ?? "",
          short_description: l.parts?.short_description ?? "",
          thread_size: l.parts?.thread_size ?? "",
          length: l.parts?.length ?? "",
          material: l.parts?.material ?? "",
          finish: l.parts?.finish ?? "",
          grade: l.parts?.grade ?? "",
          head_type: l.parts?.head_type ?? "",
          product_family: l.parts?.product_family ?? "",
          qty: l.qty,
          unit_price: l.unit_price ?? "",
          line_total: lineTotal,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cells = columnsOrder.map((k) => (values as any)[k] ?? "");
        rows.push(cells.map(csvEscape).join(","));
      }
    }

    const body = rows.join("\n") + "\n";
    const filename = filters.quote_id
      ? `quote-${filters.quote_id.slice(0, 8)}-${profileName}.csv`
      : `erp-export-${new Date().toISOString().slice(0, 10)}-${profileName}.csv`;

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
