import { createClient } from "@/lib/supabase/server";

export type PartListRow = {
  id: string;
  internal_pn: string;
  description: string | null;
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

  // Step 1: find candidate part ids via three parallel searches.
  // We use separate .ilike() calls instead of .or() to avoid PostgREST
  // filter-string parsing issues with special characters in ERPAG SKUs
  // (commas, parentheses, backslashes, etc.).
  let partIds: string[] | null = null;
  if (term) {
    const like = `%${term}%`;
    const [byPn, byDesc, byAlias] = await Promise.all([
      supabase
        .from("parts")
        .select("id")
        .is("deleted_at", null)
        .ilike("internal_pn", like)
        .limit(2000),
      supabase
        .from("parts")
        .select("id")
        .is("deleted_at", null)
        .ilike("description", like)
        .limit(2000),
      supabase
        .from("part_aliases")
        .select("part_id")
        .ilike("alias_pn", like)
        .limit(2000),
    ]);
    const ids = new Set<string>();
    byPn.data?.forEach((r) => ids.add(r.id));
    byDesc.data?.forEach((r) => ids.add(r.id));
    byAlias.data?.forEach((r) => ids.add(r.part_id));
    partIds = [...ids];
    if (partIds.length === 0) {
      return { rows: [], total: 0, page, pageSize: PAGE_SIZE };
    }
  }

  // Step 2: page through parts
  let query = supabase
    .from("parts")
    .select("id, internal_pn, description", { count: "exact" })
    .is("deleted_at", null)
    .order("internal_pn", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (partIds) {
    query = query.in("id", partIds);
  }

  const { data: parts, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = parts ?? [];

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
      description: r.description,
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
    description: string | null;
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
};

export async function getPartDetail(id: string): Promise<PartDetail | null> {
  const supabase = createClient();

  const { data: part, error } = await supabase
    .from("parts")
    .select("id, internal_pn, description, internal_notes")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!part) return null;

  const [aliasesRes, linesRes, attachmentsRes] = await Promise.all([
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
  ]);

  if (aliasesRes.error) throw new Error(aliasesRes.error.message);
  if (linesRes.error) throw new Error(linesRes.error.message);
  if (attachmentsRes.error) throw new Error(attachmentsRes.error.message);

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

  return {
    part: {
      id: part.id,
      internal_pn: part.internal_pn,
      description: part.description,
      internal_notes: part.internal_notes,
    },
    // source_type is TEXT in DB; narrowed here to the app's allowed values.
    // The form-level Zod schema enforces this on writes.
    aliases: (aliasesRes.data ?? []) as PartDetail["aliases"],
    history,
    attachments: attachmentsRes.data ?? [],
  };
}
