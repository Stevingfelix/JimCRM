import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Parts-master CSV export. Per Jim's requirements doc:
//   "Many times customers will call and quote some new items... when they
//    place an order with us, we may have to create 15 or 20 new products in
//    our own ERP system... I want to just be able to export from this
//    quoting system and upload to our system."
//
// This endpoint exports the PARTS table itself (not quote line items), with
// aliases concatenated. Filters let Jim grab only the new parts he's
// quoted in a given window so he can bulk-import them into his ERP.
//
// /api/export/parts?since=YYYY-MM-DD          parts created on/after date
// /api/export/parts?quoted_since=YYYY-MM-DD   parts first quoted on/after date
// /api/export/parts?profile=<name>            apply column mapping profile

const DEFAULT_COLUMNS = [
  "internal_pn",
  "short_description",
  "long_description",
  "internal_notes",
  "aliases",
  "target_margin_pct",
  "created_at",
] as const;

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sinceCreated = url.searchParams.get("since");
  const sinceQuoted = url.searchParams.get("quoted_since");
  const profileName = url.searchParams.get("profile") ?? undefined;

  try {
    const supabase = createAdminClient();

    // Resolve column mapping (reuses csv_export_profiles — only the
    // columns we recognize here are used; ignored otherwise).
    let columnMap: Record<string, string> = {};
    let columnsOrder: string[] = [...DEFAULT_COLUMNS];
    let resolvedName = "default";

    if (profileName) {
      const { data } = await supabase
        .from("csv_export_profiles")
        .select("name, column_map, columns_order")
        .eq("name", profileName)
        .maybeSingle();
      if (data) {
        resolvedName = data.name;
        columnMap = (data.column_map as Record<string, string>) ?? {};
        const ord = (data.columns_order ?? []).filter((k) =>
          (DEFAULT_COLUMNS as readonly string[]).includes(k),
        );
        if (ord.length > 0) columnsOrder = ord;
      }
    }

    // Fetch parts, including aliases.
    let partsQuery = supabase
      .from("parts")
      .select(
        "id, internal_pn, short_description, long_description, internal_notes, target_margin_pct, created_at, part_aliases(alias_pn, source_type, source_name)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (sinceCreated) partsQuery = partsQuery.gte("created_at", sinceCreated);

    const { data: parts, error } = await partsQuery;
    if (error) throw new Error(error.message);

    type PartRow = {
      id: string;
      internal_pn: string;
      short_description: string | null;
      long_description: string | null;
      internal_notes: string | null;
      target_margin_pct: number | string;
      created_at: string;
      part_aliases: Array<{
        alias_pn: string;
        source_type: string | null;
        source_name: string | null;
      }>;
    };

    let rows = (parts ?? []) as unknown as PartRow[];

    // Filter to parts first quoted on/after a date if requested.
    if (sinceQuoted && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const { data: firstQuotes } = await supabase
        .from("quote_lines")
        .select("part_id, created_at")
        .in("part_id", ids)
        .order("created_at", { ascending: true });
      const firstByPart = new Map<string, string>();
      (firstQuotes ?? []).forEach((q) => {
        if (q.part_id && !firstByPart.has(q.part_id)) {
          firstByPart.set(q.part_id, q.created_at);
        }
      });
      rows = rows.filter((r) => {
        const f = firstByPart.get(r.id);
        return f != null && f >= sinceQuoted;
      });
    }

    const header = columnsOrder.map((k) => columnMap[k] ?? k);
    const out: string[] = [header.join(",")];

    for (const p of rows) {
      // Aliases serialized as "alias_pn/source_type/source_name|..." (same
      // shape the bulk-import accepts on the way IN — round-trippable).
      const aliasesStr = (p.part_aliases ?? [])
        .map((a) =>
          [a.alias_pn, a.source_type ?? "", a.source_name ?? ""].join("/"),
        )
        .join("|");

      const values: Record<string, string | number | null> = {
        internal_pn: p.internal_pn,
        short_description: p.short_description ?? "",
        long_description: p.long_description ?? "",
        internal_notes: p.internal_notes ?? "",
        aliases: aliasesStr,
        target_margin_pct: Number(p.target_margin_pct),
        created_at: p.created_at,
      };

      out.push(
        columnsOrder.map((k) => csvEscape(values[k] ?? "")).join(","),
      );
    }

    const filename = `parts-${resolvedName}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(out.join("\n") + "\n", {
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
