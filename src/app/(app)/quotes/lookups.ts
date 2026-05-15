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
