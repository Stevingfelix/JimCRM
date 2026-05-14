import { createClient } from "@/lib/supabase/server";

export type CustomerListRow = {
  id: string;
  name: string;
  primary_contact_name: string | null;
  primary_email: string | null;
  quote_count: number;
  last_quote_at: string | null;
  total_quoted: number;
  total_won: number;
};

export type CustomerFilter = "all" | "with_quotes" | "no_quotes" | "with_wins";

const PAGE_SIZE = 25;

export async function listCustomers({
  q,
  filter = "all",
  page = 1,
}: {
  q?: string;
  filter?: CustomerFilter;
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

  // Optional pre-filter to a set of ids based on search or activity filter.
  // Activity filters need a join over quotes; we do them as separate look-ups
  // and intersect with the search id-set.
  let ids: string[] | null = null;

  if (term) {
    const like = `%${term}%`;
    const [byName, byContact] = await Promise.all([
      supabase.from("customers").select("id").ilike("name", like),
      supabase
        .from("customer_contacts")
        .select("customer_id, name, email")
        .or(`name.ilike.${like},email.ilike.${like}`),
    ]);
    const set = new Set<string>();
    byName.data?.forEach((r) => set.add(r.id));
    byContact.data?.forEach((r) => set.add(r.customer_id));
    ids = [...set];
    if (ids.length === 0) {
      return { rows: [], total: 0, page, pageSize: PAGE_SIZE };
    }
  }

  if (filter !== "all") {
    const activityQuery = supabase
      .from("quotes")
      .select("customer_id, status")
      .is("deleted_at", null);
    const { data: activity } = await activityQuery;
    const byCustomer = new Map<string, Set<string>>();
    activity?.forEach((q) => {
      if (!byCustomer.has(q.customer_id)) {
        byCustomer.set(q.customer_id, new Set());
      }
      byCustomer.get(q.customer_id)!.add(q.status);
    });

    const matches = (statuses: Set<string> | undefined): boolean => {
      switch (filter) {
        case "with_quotes":
          return !!statuses && statuses.size > 0;
        case "no_quotes":
          return !statuses || statuses.size === 0;
        case "with_wins":
          return !!statuses && statuses.has("won");
        default:
          return true;
      }
    };

    if (filter === "no_quotes") {
      // Need to apply against the full customers set, not just those with
      // activity. Fetch all customer ids and exclude any that appear in
      // byCustomer.
      const { data: allIds } = await supabase
        .from("customers")
        .select("id")
        .is("deleted_at", null);
      const filtered = (allIds ?? [])
        .map((r) => r.id)
        .filter((id) => !byCustomer.has(id));
      ids = ids ? ids.filter((id) => filtered.includes(id)) : filtered;
    } else {
      const filtered: string[] = [];
      byCustomer.forEach((s, id) => {
        if (matches(s)) filtered.push(id);
      });
      ids = ids ? ids.filter((id) => filtered.includes(id)) : filtered;
    }

    if (ids.length === 0) {
      return { rows: [], total: 0, page, pageSize: PAGE_SIZE };
    }
  }

  let query = supabase
    .from("customers")
    .select("id, name", { count: "exact" })
    .is("deleted_at", null)
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
      .select("customer_id, name, email")
      .in("customer_id", customerIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("quotes")
      .select(
        "customer_id, status, created_at, quote_lines(qty, unit_price)",
      )
      .in("customer_id", customerIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const primaryEmail = new Map<string, string>();
  const primaryContactName = new Map<string, string>();
  contactsRes.data?.forEach((c) => {
    if (c.email && !primaryEmail.has(c.customer_id)) {
      primaryEmail.set(c.customer_id, c.email);
    }
    if (c.name && !primaryContactName.has(c.customer_id)) {
      primaryContactName.set(c.customer_id, c.name);
    }
  });

  type QRow = {
    customer_id: string;
    status: string;
    created_at: string;
    quote_lines: Array<{ qty: number; unit_price: number | null }>;
  };

  const counts = new Map<string, number>();
  const lastAt = new Map<string, string>();
  const totalQuoted = new Map<string, number>();
  const totalWon = new Map<string, number>();
  (quotesRes.data as unknown as QRow[] | null)?.forEach((q) => {
    counts.set(q.customer_id, (counts.get(q.customer_id) ?? 0) + 1);
    if (!lastAt.has(q.customer_id)) lastAt.set(q.customer_id, q.created_at);
    const sum = q.quote_lines.reduce<number>((acc, l) => {
      if (l.unit_price == null) return acc;
      return acc + l.qty * l.unit_price;
    }, 0);
    totalQuoted.set(
      q.customer_id,
      (totalQuoted.get(q.customer_id) ?? 0) + sum,
    );
    if (q.status === "won") {
      totalWon.set(q.customer_id, (totalWon.get(q.customer_id) ?? 0) + sum);
    }
  });

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      primary_contact_name: primaryContactName.get(r.id) ?? null,
      primary_email: primaryEmail.get(r.id) ?? null,
      quote_count: counts.get(r.id) ?? 0,
      last_quote_at: lastAt.get(r.id) ?? null,
      total_quoted: totalQuoted.get(r.id) ?? 0,
      total_won: totalWon.get(r.id) ?? 0,
    })),
    total: count ?? rows.length,
    page,
    pageSize: PAGE_SIZE,
  };
}

export type CustomerDetail = {
  customer: {
    id: string;
    name: string;
    notes: string | null;
    markup_multiplier: number;
    discount_pct: number;
    pricing_notes: string | null;
  };
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
    .select("id, name, notes, markup_multiplier, discount_pct, pricing_notes")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) return null;

  const customerNormalized = {
    id: customer.id,
    name: customer.name,
    notes: customer.notes,
    markup_multiplier: Number(customer.markup_multiplier ?? 1),
    discount_pct: Number(customer.discount_pct ?? 0),
    pricing_notes: customer.pricing_notes,
  };

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
    customer: customerNormalized,
    contacts: contactsRes.data ?? [],
    recentQuotes,
  };
}
