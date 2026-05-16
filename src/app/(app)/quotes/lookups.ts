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

export type SimilarVendorRec = {
  vendor_name: string;
  unit_price: number;
  lead_time_days: number | null;
  matched_part_pn: string;
  match_reason: string; // e.g. "same thread size" or "same product family"
};

/**
 * Find vendor pricing for parts with similar specs — useful when no exact
 * part match exists (new/unmatched lines in the review queue).
 */
export async function getSimilarVendorRecsAction(specs: {
  thread_size?: string | null;
  material?: string | null;
  product_family?: string | null;
}): Promise<SimilarVendorRec[]> {
  const supabase = createClient();
  const results: SimilarVendorRec[] = [];
  const seenVendors = new Set<string>();

  // Priority 1: Same thread size — closest physical match
  if (specs.thread_size) {
    const { data } = await supabase
      .from("vendor_quotes")
      .select("unit_price, lead_time_days, vendors!inner(name), parts!inner(internal_pn, thread_size)")
      .eq("parts.thread_size", specs.thread_size)
      .order("unit_price", { ascending: true })
      .limit(5);

    type Row = {
      unit_price: number;
      lead_time_days: number | null;
      vendors: { name: string };
      parts: { internal_pn: string; thread_size: string | null };
    };

    for (const r of (data ?? []) as unknown as Row[]) {
      if (seenVendors.has(r.vendors.name)) continue;
      seenVendors.add(r.vendors.name);
      results.push({
        vendor_name: r.vendors.name,
        unit_price: r.unit_price,
        lead_time_days: r.lead_time_days,
        matched_part_pn: r.parts.internal_pn,
        match_reason: `same thread (${specs.thread_size})`,
      });
    }
  }

  // Priority 2: Same material (if we still have room)
  if (specs.material && results.length < 3) {
    const { data } = await supabase
      .from("vendor_quotes")
      .select("unit_price, lead_time_days, vendors!inner(name), parts!inner(internal_pn, material)")
      .eq("parts.material", specs.material)
      .order("unit_price", { ascending: true })
      .limit(5);

    type Row = {
      unit_price: number;
      lead_time_days: number | null;
      vendors: { name: string };
      parts: { internal_pn: string; material: string | null };
    };

    for (const r of (data ?? []) as unknown as Row[]) {
      if (seenVendors.has(r.vendors.name)) continue;
      seenVendors.add(r.vendors.name);
      results.push({
        vendor_name: r.vendors.name,
        unit_price: r.unit_price,
        lead_time_days: r.lead_time_days,
        matched_part_pn: r.parts.internal_pn,
        match_reason: `same material (${specs.material})`,
      });
      if (results.length >= 3) break;
    }
  }

  // Priority 3: Same product family (broadest match)
  if (specs.product_family && results.length < 3) {
    const { data } = await supabase
      .from("vendor_quotes")
      .select("unit_price, lead_time_days, vendors!inner(name), parts!inner(internal_pn, product_family)")
      .eq("parts.product_family", specs.product_family)
      .order("unit_price", { ascending: true })
      .limit(5);

    type Row = {
      unit_price: number;
      lead_time_days: number | null;
      vendors: { name: string };
      parts: { internal_pn: string; product_family: string | null };
    };

    for (const r of (data ?? []) as unknown as Row[]) {
      if (seenVendors.has(r.vendors.name)) continue;
      seenVendors.add(r.vendors.name);
      results.push({
        vendor_name: r.vendors.name,
        unit_price: r.unit_price,
        lead_time_days: r.lead_time_days,
        matched_part_pn: r.parts.internal_pn,
        match_reason: `same family (${specs.product_family})`,
      });
      if (results.length >= 3) break;
    }
  }

  return results.slice(0, 3);
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
