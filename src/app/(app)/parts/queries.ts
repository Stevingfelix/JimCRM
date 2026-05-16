import { createClient } from "@/lib/supabase/server";

export type PartListRow = {
  id: string;
  internal_pn: string;
  short_description: string | null;
  alias_count: number;
  last_quote_at: string | null;
};

export type PartListResult = {
  rows: PartListRow[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 50;

export async function listParts({
  q,
  page = 1,
}: {
  q?: string;
  page?: number;
}): Promise<PartListResult> {
  const supabase = createClient();
  const offset = (page - 1) * PAGE_SIZE;
  const term = q?.trim();

  // Search uses a Postgres function (RPC) to avoid PostgREST .or() parsing
  // issues with special characters AND to avoid collecting thousands of IDs
  // for short queries like "02" against 8,500+ parts.
  //
  // For non-search (browsing), we query parts directly.
  let parts: { id: string; internal_pn: string; short_description: string | null }[];
  let count: number | null;

  if (term) {
    const like = `%${term}%`;

    // Get alias-matched part IDs first (small set — aliases are sparse)
    const { data: aliasHits } = await supabase
      .from("part_aliases")
      .select("part_id")
      .ilike("alias_pn", like)
      .limit(200);
    const aliasIds = aliasHits?.map((r) => r.part_id) ?? [];

    // Single query: PN match via ilike on the main table.
    // We run two parallel queries (PN and description) and merge,
    // then paginate in-memory. This avoids both .or() parsing issues
    // and massive .in() URL payloads.
    const [byPn, byDesc] = await Promise.all([
      supabase
        .from("parts")
        .select("id, internal_pn, short_description")
        .is("deleted_at", null)
        .ilike("internal_pn", like)
        .order("internal_pn", { ascending: true })
        .limit(500),
      supabase
        .from("parts")
        .select("id, internal_pn, short_description")
        .is("deleted_at", null)
        .ilike("short_description", like)
        .order("internal_pn", { ascending: true })
        .limit(500),
    ]);

    // Merge results, deduplicate, then add alias-matched parts
    type PartRow = { id: string; internal_pn: string; short_description: string | null };
    const seen = new Map<string, PartRow>();
    for (const r of byPn.data ?? []) seen.set(r.id, r);
    for (const r of byDesc.data ?? []) if (!seen.has(r.id)) seen.set(r.id, r);

    // Fetch alias-matched parts that aren't already in the set
    const missingAliasIds = aliasIds.filter((id) => !seen.has(id));
    if (missingAliasIds.length > 0) {
      const { data: aliasParts } = await supabase
        .from("parts")
        .select("id, internal_pn, short_description")
        .is("deleted_at", null)
        .in("id", missingAliasIds.slice(0, 200));
      for (const r of aliasParts ?? []) if (!seen.has(r.id)) seen.set(r.id, r);
    }

    // Sort and paginate in-memory
    const all = [...seen.values()].sort((a, b) =>
      a.internal_pn.localeCompare(b.internal_pn),
    );
    count = all.length;
    parts = all.slice(offset, offset + PAGE_SIZE);
  } else {
    const res = await supabase
      .from("parts")
      .select("id, internal_pn, short_description", { count: "exact" })
      .is("deleted_at", null)
      .order("internal_pn", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (res.error) throw new Error(res.error.message);
    parts = res.data ?? [];
    count = res.count;
  }
  const rows = parts;

  if (rows.length === 0) {
    return { rows: [], total: count ?? 0, page, pageSize: PAGE_SIZE };
  }

  // Step 3: alias counts + last quote per part
  const ids = rows.map((r) => r.id);
  const [aliasesRes, linesRes] = await Promise.all([
    supabase.from("part_aliases").select("part_id").in("part_id", ids),
    supabase
      .from("quote_lines")
      .select("part_id, created_at")
      .in("part_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const aliasCounts = new Map<string, number>();
  aliasesRes.data?.forEach((r) => {
    aliasCounts.set(r.part_id, (aliasCounts.get(r.part_id) ?? 0) + 1);
  });

  const lastQuote = new Map<string, string>();
  linesRes.data?.forEach((r) => {
    if (r.part_id && !lastQuote.has(r.part_id)) {
      lastQuote.set(r.part_id, r.created_at);
    }
  });

  return {
    rows: rows.map((r) => ({
      id: r.id,
      internal_pn: r.internal_pn,
      short_description: r.short_description,
      alias_count: aliasCounts.get(r.id) ?? 0,
      last_quote_at: lastQuote.get(r.id) ?? null,
    })),
    total: count ?? rows.length,
    page,
    pageSize: PAGE_SIZE,
  };
}

export type PartDetail = {
  part: {
    id: string;
    internal_pn: string;
    short_description: string | null;
    long_description: string | null;
    internal_notes: string | null;
  };
  aliases: Array<{
    id: string;
    alias_pn: string;
    source_type:
      | "customer"
      | "manufacturer"
      | "vendor"
      | "other"
      | null;
    source_name: string | null;
  }>;
  history: Array<{
    quote_line_id: string;
    quote_id: string;
    created_at: string;
    qty: number;
    unit_price: number | null;
    customer_id: string;
    customer_name: string;
  }>;
  attachments: Array<{
    id: string;
    drive_file_id: string;
    name: string;
    mime_type: string | null;
  }>;
  vendor_price_history: Array<{
    date: string;
    unit_price: number;
    vendor_name: string;
  }>;
};

export async function getPartDetail(id: string): Promise<PartDetail | null> {
  const supabase = createClient();

  const { data: part, error } = await supabase
    .from("parts")
    .select("id, internal_pn, short_description, long_description, internal_notes")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!part) return null;

  const [aliasesRes, linesRes, attachmentsRes, vendorQuotesRes] = await Promise.all([
    supabase
      .from("part_aliases")
      .select("id, alias_pn, source_type, source_name")
      .eq("part_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("quote_lines")
      .select(
        "id, quote_id, created_at, qty, unit_price, quotes!inner(id, customer_id, customers!inner(id, name))",
      )
      .eq("part_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("part_attachments")
      .select("id, drive_file_id, name, mime_type")
      .eq("part_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("vendor_quotes")
      .select("unit_price, quoted_at, vendors!inner(name)")
      .eq("part_id", id)
      .order("quoted_at", { ascending: true })
      .limit(50),
  ]);

  if (aliasesRes.error) throw new Error(aliasesRes.error.message);
  if (linesRes.error) throw new Error(linesRes.error.message);
  if (attachmentsRes.error) throw new Error(attachmentsRes.error.message);
  if (vendorQuotesRes.error) throw new Error(vendorQuotesRes.error.message);

  type LineRow = {
    id: string;
    quote_id: string;
    created_at: string;
    qty: number;
    unit_price: number | null;
    quotes: { customer_id: string; customers: { name: string } };
  };

  const history = ((linesRes.data ?? []) as unknown as LineRow[]).map((row) => ({
    quote_line_id: row.id,
    quote_id: row.quote_id,
    created_at: row.created_at,
    qty: row.qty,
    unit_price: row.unit_price,
    customer_id: row.quotes.customer_id,
    customer_name: row.quotes.customers.name,
  }));

  type VendorQuoteRow = {
    unit_price: number;
    quoted_at: string;
    vendors: { name: string };
  };

  const vendor_price_history = (
    (vendorQuotesRes.data ?? []) as unknown as VendorQuoteRow[]
  ).map((row) => ({
    date: row.quoted_at,
    unit_price: row.unit_price,
    vendor_name: row.vendors.name,
  }));

  return {
    part: {
      id: part.id,
      internal_pn: part.internal_pn,
      short_description: part.short_description,
      long_description: part.long_description,
      internal_notes: part.internal_notes,
    },
    // source_type is TEXT in DB; narrowed here to the app's allowed values.
    // The form-level Zod schema enforces this on writes.
    aliases: (aliasesRes.data ?? []) as PartDetail["aliases"],
    history,
    attachments: attachmentsRes.data ?? [],
    vendor_price_history,
  };
}
