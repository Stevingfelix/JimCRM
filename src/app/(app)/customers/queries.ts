import { createClient } from "@/lib/supabase/server";

export type CustomerListRow = {
  id: string;
  name: string;
  primary_email: string | null;
  quote_count: number;
  last_quote_at: string | null;
};

const PAGE_SIZE = 50;

export async function listCustomers({
  q,
  page = 1,
}: {
  q?: string;
  page?: number;
}): Promise<{
  rows: CustomerListRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const supabase = createClient();
  const offset = (page - 1) * PAGE_SIZE;
  const term = q?.trim();

  let ids: string[] | null = null;
  if (term) {
    const like = `%${term}%`;
    const [byName, byContact] = await Promise.all([
      supabase.from("customers").select("id").ilike("name", like),
      supabase
        .from("customer_contacts")
        .select("customer_id")
        .ilike("email", like),
    ]);
    const set = new Set<string>();
    byName.data?.forEach((r) => set.add(r.id));
    byContact.data?.forEach((r) => set.add(r.customer_id));
    ids = [...set];
    if (ids.length === 0) {
      return { rows: [], total: 0, page, pageSize: PAGE_SIZE };
    }
  }

  let query = supabase
    .from("customers")
    .select("id, name", { count: "exact" })
    .order("name", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);
  if (ids) query = query.in("id", ids);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) {
    return { rows: [], total: count ?? 0, page, pageSize: PAGE_SIZE };
  }

  const customerIds = rows.map((r) => r.id);
  const [contactsRes, quotesRes] = await Promise.all([
    supabase
      .from("customer_contacts")
      .select("customer_id, email")
      .in("customer_id", customerIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("quotes")
      .select("customer_id, created_at")
      .in("customer_id", customerIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const primaryEmail = new Map<string, string>();
  contactsRes.data?.forEach((c) => {
    if (c.email && !primaryEmail.has(c.customer_id)) {
      primaryEmail.set(c.customer_id, c.email);
    }
  });

  const counts = new Map<string, number>();
  const lastAt = new Map<string, string>();
  quotesRes.data?.forEach((q) => {
    counts.set(q.customer_id, (counts.get(q.customer_id) ?? 0) + 1);
    if (!lastAt.has(q.customer_id)) {
      lastAt.set(q.customer_id, q.created_at);
    }
  });

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      primary_email: primaryEmail.get(r.id) ?? null,
      quote_count: counts.get(r.id) ?? 0,
      last_quote_at: lastAt.get(r.id) ?? null,
    })),
    total: count ?? rows.length,
    page,
    pageSize: PAGE_SIZE,
  };
}

export type CustomerDetail = {
  customer: { id: string; name: string; notes: string | null };
  contacts: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
  }>;
  recentQuotes: Array<{
    id: string;
    status: string;
    created_at: string;
    line_count: number;
    total: number | null;
  }>;
};

export async function getCustomerDetail(
  id: string,
): Promise<CustomerDetail | null> {
  const supabase = createClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, name, notes")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) return null;

  const [contactsRes, quotesRes] = await Promise.all([
    supabase
      .from("customer_contacts")
      .select("id, name, email, phone, role")
      .eq("customer_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("quotes")
      .select("id, status, created_at, quote_lines(qty, unit_price)")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (contactsRes.error) throw new Error(contactsRes.error.message);
  if (quotesRes.error) throw new Error(quotesRes.error.message);

  type QuoteRow = {
    id: string;
    status: string;
    created_at: string;
    quote_lines: Array<{ qty: number; unit_price: number | null }>;
  };

  const recentQuotes = ((quotesRes.data ?? []) as unknown as QuoteRow[]).map(
    (q) => ({
      id: q.id,
      status: q.status,
      created_at: q.created_at,
      line_count: q.quote_lines.length,
      total: q.quote_lines.reduce<number | null>((acc, l) => {
        if (l.unit_price == null) return acc;
        return (acc ?? 0) + l.qty * l.unit_price;
      }, null),
    }),
  );

  return {
    customer,
    contacts: contactsRes.data ?? [],
    recentQuotes,
  };
}
