"use server";

import { searchPartsForLine, getPartHistory } from "./queries";
import { createClient } from "@/lib/supabase/server";

export async function searchPartsAction(q: string) {
  return searchPartsForLine(q);
}

export async function getPartHistoryAction(partId: string) {
  return getPartHistory(partId);
}

export async function searchVendorsAction(q: string) {
  const supabase = createClient();
  const term = q.trim();
  if (!term) {
    const { data } = await supabase
      .from("vendors")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(15);
    return data ?? [];
  }
  const { data } = await supabase
    .from("vendors")
    .select("id, name")
    .ilike("name", `%${term}%`)
    .order("name", { ascending: true })
    .limit(15);
  return data ?? [];
}

export type QuickVendorRec = {
  vendor_name: string;
  unit_price: number;
  lead_time_days: number | null;
};

export async function getVendorRecsAction(
  partId: string,
): Promise<QuickVendorRec[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("vendor_quotes")
    .select("unit_price, lead_time_days, quoted_at, vendors!inner(name)")
    .eq("part_id", partId)
    .order("unit_price", { ascending: true })
    .order("quoted_at", { ascending: false })
    .limit(3);
  if (!data || data.length === 0) return [];
  type Row = {
    unit_price: number;
    lead_time_days: number | null;
    vendors: { name: string };
  };
  return (data as unknown as Row[]).map((r) => ({
    vendor_name: r.vendors.name,
    unit_price: r.unit_price,
    lead_time_days: r.lead_time_days,
  }));
}

export type DraftQuoteResult = {
  id: string;
  quote_number: number;
  customer_name: string;
  line_count: number;
};

export async function searchDraftQuotesAction(
  q: string,
): Promise<DraftQuoteResult[]> {
  const supabase = createClient();
  const term = q.trim();

  let query = supabase
    .from("quotes")
    .select("id, quote_number, customers!inner(name), quote_lines(id)")
    .eq("status", "draft")
    .is("deleted_at", null)
    .order("quote_number", { ascending: false })
    .limit(10);

  if (term) {
    // Filter by quote_number (numeric match) or customer name (ilike).
    const asNum = Number(term);
    if (!Number.isNaN(asNum) && Number.isInteger(asNum)) {
      query = query.or(`quote_number.eq.${asNum},customers.name.ilike.%${term}%`);
    } else {
      query = query.ilike("customers.name", `%${term}%`);
    }
  }

  const { data } = await query;
  if (!data) return [];

  type Row = {
    id: string;
    quote_number: number;
    customers: { name: string };
    quote_lines: { id: string }[];
  };

  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    quote_number: r.quote_number,
    customer_name: r.customers.name,
    line_count: r.quote_lines?.length ?? 0,
  }));
}

export async function searchCustomersAction(q: string) {
  const supabase = createClient();
  const term = q.trim();
  if (!term) {
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(15);
    return data ?? [];
  }
  const { data } = await supabase
    .from("customers")
    .select("id, name")
    .ilike("name", `%${term}%`)
    .order("name", { ascending: true })
    .limit(15);
  return data ?? [];
}
