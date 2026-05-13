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
