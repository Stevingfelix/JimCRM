import { createClient } from "@/lib/supabase/server";

export type VendorListRow = {
  id: string;
  name: string;
  categories: string[];
  parts_quoted: number;
  last_quote_at: string | null;
};

const PAGE_SIZE = 50;

export async function listVendors({
  q,
  category,
  page = 1,
}: {
  q?: string;
  category?: string;
  page?: number;
}): Promise<{
  rows: VendorListRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
}> {
  const supabase = createClient();
  const offset = (page - 1) * PAGE_SIZE;
  const term = q?.trim();

  let ids: string[] | null = null;
  if (term) {
    const like = `%${term}%`;
    const [byName, byContact] = await Promise.all([
      supabase.from("vendors").select("id").ilike("name", like),
      supabase
        .from("vendor_contacts")
        .select("vendor_id")
        .ilike("email", like),
    ]);
    const set = new Set<string>();
    byName.data?.forEach((r) => set.add(r.id));
    byContact.data?.forEach((r) => set.add(r.vendor_id));
    ids = [...set];
    if (ids.length === 0) {
      const categories = await fetchAllCategories(supabase);
      return { rows: [], total: 0, page, pageSize: PAGE_SIZE, categories };
    }
  }

  let query = supabase
    .from("vendors")
    .select("id, name, categories", { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);
  if (ids) query = query.in("id", ids);
  if (category) query = query.contains("categories", [category]);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const categories = await fetchAllCategories(supabase);

  if (rows.length === 0) {
    return { rows: [], total: count ?? 0, page, pageSize: PAGE_SIZE, categories };
  }

  const vendorIds = rows.map((r: { id: string }) => r.id);
  const { data: vqData } = await supabase
    .from("vendor_quotes")
    .select("vendor_id, part_id, quoted_at")
    .in("vendor_id", vendorIds)
    .order("quoted_at", { ascending: false });

  const partsByVendor = new Map<string, Set<string>>();
  const lastAt = new Map<string, string>();
  vqData?.forEach(
    (r: {
      vendor_id: string;
      part_id: string | null;
      quoted_at: string;
    }) => {
      if (r.part_id) {
        if (!partsByVendor.has(r.vendor_id)) {
          partsByVendor.set(r.vendor_id, new Set());
        }
        partsByVendor.get(r.vendor_id)!.add(r.part_id);
      }
      if (!lastAt.has(r.vendor_id)) lastAt.set(r.vendor_id, r.quoted_at);
    },
  );

  return {
    rows: rows.map((r: { id: string; name: string; categories: string[] }) => ({
      id: r.id,
      name: r.name,
      categories: r.categories ?? [],
      parts_quoted: partsByVendor.get(r.id)?.size ?? 0,
      last_quote_at: lastAt.get(r.id) ?? null,
    })),
    total: count ?? rows.length,
    page,
    pageSize: PAGE_SIZE,
    categories,
  };
}

async function fetchAllCategories(
  supabase: ReturnType<typeof createClient>,
): Promise<string[]> {
  const { data } = await supabase.from("vendors").select("categories");
  const set = new Set<string>();
  (data as Array<{ categories: string[] | null }> | null)?.forEach((r) => {
    r.categories?.forEach((c) => set.add(c));
  });
  return [...set].sort();
}

export type VendorDetail = {
  vendor: {
    id: string;
    name: string;
    categories: string[];
    notes: string | null;
  };
  contacts: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
  }>;
  recentVendorQuotes: Array<{
    id: string;
    quoted_at: string;
    qty: number | null;
    unit_price: number;
    lead_time_days: number | null;
    source_note: string | null;
    part_id: string | null;
    part_internal_pn: string | null;
  }>;
};

export async function getVendorDetail(
  id: string,
): Promise<VendorDetail | null> {
  const supabase = createClient();

  const { data: vendor, error } = await supabase
    .from("vendors")
    .select("id, name, categories, notes")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!vendor) return null;

  const [contactsRes, vqRes] = await Promise.all([
    supabase
      .from("vendor_contacts")
      .select("id, name, email, phone, role")
      .eq("vendor_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("vendor_quotes")
      .select(
        "id, quoted_at, qty, unit_price, lead_time_days, source_note, part_id, parts(internal_pn)",
      )
      .eq("vendor_id", id)
      .order("quoted_at", { ascending: false })
      .limit(15),
  ]);

  if (contactsRes.error) throw new Error(contactsRes.error.message);
  if (vqRes.error) throw new Error(vqRes.error.message);

  type VqRow = {
    id: string;
    quoted_at: string;
    qty: number | null;
    unit_price: number;
    lead_time_days: number | null;
    source_note: string | null;
    part_id: string | null;
    parts: { internal_pn: string } | null;
  };

  const recentVendorQuotes = ((vqRes.data ?? []) as unknown as VqRow[]).map(
    (r) => ({
      id: r.id,
      quoted_at: r.quoted_at,
      qty: r.qty,
      unit_price: r.unit_price,
      lead_time_days: r.lead_time_days,
      source_note: r.source_note,
      part_id: r.part_id,
      part_internal_pn: r.parts?.internal_pn ?? null,
    }),
  );

  return {
    vendor: {
      id: vendor.id,
      name: vendor.name,
      categories: vendor.categories ?? [],
      notes: vendor.notes,
    },
    contacts: contactsRes.data ?? [],
    recentVendorQuotes,
  };
}
