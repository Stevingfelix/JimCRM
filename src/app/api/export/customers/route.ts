import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Customers CSV export. Headers match what Jim's ERP / spreadsheet
// templates expect: company, primary contact, email, phone, billing
// address, plus a count + last-quote-at so the file is useful as a
// stand-alone customer roster.

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: customers, error } = await supabase
      .from("customers")
      .select(
        "id, name, billing_address, notes, created_at, customer_contacts(name, email, phone, created_at)",
      )
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      name: string;
      billing_address: string | null;
      notes: string | null;
      created_at: string;
      customer_contacts: Array<{
        name: string | null;
        email: string | null;
        phone: string | null;
        created_at: string;
      }>;
    };
    const rows = (customers ?? []) as unknown as Row[];

    // Per-customer quote stats.
    const ids = rows.map((r) => r.id);
    const stats = new Map<
      string,
      { count: number; last: string | null; total: number }
    >();
    if (ids.length > 0) {
      const { data: quotes } = await supabase
        .from("quotes")
        .select("customer_id, created_at, quote_lines(qty, unit_price)")
        .in("customer_id", ids)
        .is("deleted_at", null);
      type QRow = {
        customer_id: string;
        created_at: string;
        quote_lines: Array<{ qty: number; unit_price: number | null }>;
      };
      (quotes as unknown as QRow[] | null)?.forEach((q) => {
        const cur = stats.get(q.customer_id) ?? {
          count: 0,
          last: null as string | null,
          total: 0,
        };
        cur.count += 1;
        if (!cur.last || q.created_at > cur.last) cur.last = q.created_at;
        cur.total += q.quote_lines.reduce<number>((a, l) => {
          if (l.unit_price == null) return a;
          return a + l.qty * l.unit_price;
        }, 0);
        stats.set(q.customer_id, cur);
      });
    }

    const header = [
      "company",
      "primary_contact_name",
      "primary_contact_email",
      "primary_contact_phone",
      "billing_address",
      "notes",
      "quote_count",
      "last_quote_at",
      "total_quoted",
      "created_at",
    ];

    const out: string[] = [header.join(",")];

    for (const c of rows) {
      // Earliest-created contact is the "primary" one for export purposes.
      const sorted = [...c.customer_contacts].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      const pc = sorted[0];
      const s = stats.get(c.id) ?? { count: 0, last: null, total: 0 };
      const values = [
        c.name,
        pc?.name ?? "",
        pc?.email ?? "",
        pc?.phone ?? "",
        c.billing_address ?? "",
        c.notes ?? "",
        s.count,
        s.last ?? "",
        s.total.toFixed(2),
        c.created_at,
      ];
      out.push(values.map(csvEscape).join(","));
    }

    const filename = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
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
