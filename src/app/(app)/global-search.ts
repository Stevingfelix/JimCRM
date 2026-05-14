"use server";

import { createClient } from "@/lib/supabase/server";

export type GlobalSearchHit = {
  kind: "part" | "customer" | "vendor" | "quote";
  id: string;
  href: string;
  title: string;
  subtitle: string | null;
};

const PER_KIND_LIMIT = 5;

export async function globalSearch(qRaw: string): Promise<GlobalSearchHit[]> {
  const q = qRaw.trim();
  if (q.length === 0) return [];
  const supabase = createClient();
  const like = `%${q}%`;

  const [partsRes, customersRes, vendorsRes, quotesByNumberRes] =
    await Promise.all([
      supabase
        .from("parts")
        .select("id, internal_pn, description")
        .or(`internal_pn.ilike.${like},description.ilike.${like}`)
        .is("deleted_at", null)
        .limit(PER_KIND_LIMIT),
      supabase
        .from("customers")
        .select("id, name")
        .ilike("name", like)
        .limit(PER_KIND_LIMIT),
      supabase
        .from("vendors")
        .select("id, name")
        .ilike("name", like)
        .limit(PER_KIND_LIMIT),
      // Quote search: by number (Q-0492 or 492) OR by customer name
      (async () => {
        const num = Number(q.replace(/^Q-?/i, ""));
        if (!Number.isNaN(num) && num > 0) {
          return supabase
            .from("quotes")
            .select("id, quote_number, status, customers!inner(name)")
            .eq("quote_number", num)
            .is("deleted_at", null)
            .limit(PER_KIND_LIMIT);
        }
        // Match quotes by customer name
        const { data: matchedCustomers } = await supabase
          .from("customers")
          .select("id")
          .ilike("name", like)
          .limit(10);
        if (!matchedCustomers || matchedCustomers.length === 0) {
          return { data: [], error: null };
        }
        return supabase
          .from("quotes")
          .select("id, quote_number, status, customers!inner(name)")
          .in(
            "customer_id",
            matchedCustomers.map((c) => c.id),
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(PER_KIND_LIMIT);
      })(),
    ]);

  const hits: GlobalSearchHit[] = [];

  for (const p of partsRes.data ?? []) {
    hits.push({
      kind: "part",
      id: p.id,
      href: `/parts/${p.id}`,
      title: p.internal_pn,
      subtitle: p.description,
    });
  }
  for (const c of customersRes.data ?? []) {
    hits.push({
      kind: "customer",
      id: c.id,
      href: `/customers/${c.id}`,
      title: c.name,
      subtitle: null,
    });
  }
  for (const v of vendorsRes.data ?? []) {
    hits.push({
      kind: "vendor",
      id: v.id,
      href: `/vendors/${v.id}`,
      title: v.name,
      subtitle: null,
    });
  }
  type QuoteRow = {
    id: string;
    quote_number: number;
    status: string;
    customers: { name: string };
  };
  for (const qr of (quotesByNumberRes.data ?? []) as unknown as QuoteRow[]) {
    hits.push({
      kind: "quote",
      id: qr.id,
      href: `/quotes/${qr.id}`,
      title: `Q-${String(qr.quote_number).padStart(4, "0")}`,
      subtitle: `${qr.customers.name} · ${qr.status}`,
    });
  }

  return hits;
}
