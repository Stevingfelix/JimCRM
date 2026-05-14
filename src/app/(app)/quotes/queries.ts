import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

export type QuoteStatus = "draft" | "sent" | "won" | "lost" | "expired";
export const QUOTE_STATUSES: QuoteStatus[] = [
  "draft",
  "sent",
  "won",
  "lost",
  "expired",
];

export type QuoteListRow = {
  id: string;
  quote_number: number;
  customer_id: string;
  customer_name: string;
  status: QuoteStatus;
  created_at: string;
  validity_date: string | null;
  line_count: number;
  total: number | null;
};

export async function listQuotes({
  q,
  status,
  page = 1,
}: {
  q?: string;
  status?: QuoteStatus | null;
  page?: number;
}): Promise<{
  rows: QuoteListRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const supabase = createClient();
  const offset = (page - 1) * PAGE_SIZE;
  const term = q?.trim();

  let customerIds: string[] | null = null;
  if (term && !/^Q-?\d+/i.test(term)) {
    // free-text matches customer name
    const { data } = await supabase
      .from("customers")
      .select("id")
      .ilike("name", `%${term}%`);
    customerIds = data?.map((r) => r.id) ?? [];
    if (customerIds.length === 0) {
      return { rows: [], total: 0, page, pageSize: PAGE_SIZE };
    }
  }

  let query = supabase
    .from("quotes")
    .select(
      "id, quote_number, customer_id, status, created_at, validity_date, customers!inner(name), quote_lines(qty, unit_price)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (customerIds) query = query.in("customer_id", customerIds);
  if (term && /^Q-?\d+/i.test(term)) {
    const n = Number(term.replace(/^Q-?/i, ""));
    if (!Number.isNaN(n)) query = query.eq("quote_number", n);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    quote_number: number;
    customer_id: string;
    status: QuoteStatus;
    created_at: string;
    validity_date: string | null;
    customers: { name: string };
    quote_lines: Array<{ qty: number; unit_price: number | null }>;
  };

  const rows: QuoteListRow[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    quote_number: r.quote_number,
    customer_id: r.customer_id,
    customer_name: r.customers.name,
    status: r.status,
    created_at: r.created_at,
    validity_date: r.validity_date,
    line_count: r.quote_lines.length,
    total: r.quote_lines.reduce<number | null>((acc, l) => {
      if (l.unit_price == null) return acc;
      return (acc ?? 0) + l.qty * l.unit_price;
    }, null),
  }));

  return {
    rows,
    total: count ?? rows.length,
    page,
    pageSize: PAGE_SIZE,
  };
}

export type VendorRecommendation = {
  vendor_id: string;
  vendor_name: string;
  unit_price: number;
  lead_time_days: number | null;
  quoted_at: string;
};

export type QuoteLineDetail = {
  id: string;
  position: number;
  part_id: string | null;
  part_internal_pn: string | null;
  part_description: string | null;
  part_target_margin_pct: number | null;
  qty: number;
  unit_price: number | null;
  ai_suggested_price: number | null;
  ai_reasoning: string | null;
  override_reason: string | null;
  line_notes_internal: string | null;
  line_notes_customer: string | null;
  recommended_vendor: VendorRecommendation | null;
  alt_vendors: VendorRecommendation[];
};

export type QuoteAttachment = {
  id: string;
  drive_file_id: string;
  name: string;
  mime_type: string | null;
};

export type QuoteDetail = {
  quote: {
    id: string;
    quote_number: number;
    customer_id: string;
    customer_name: string;
    status: QuoteStatus;
    validity_date: string | null;
    customer_notes: string | null;
    internal_notes: string | null;
    template_id: string | null;
    sent_at: string | null;
    created_at: string;
    public_token: string | null;
  };
  templates: Array<{ id: string; name: string; is_default: boolean }>;
  lines: QuoteLineDetail[];
  attachments: QuoteAttachment[];
};

export async function getQuoteDetail(id: string): Promise<QuoteDetail | null> {
  const supabase = createClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, customer_id, status, validity_date, customer_notes, internal_notes, template_id, sent_at, created_at, customers!inner(name)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!quote) return null;

  type QuoteRow = {
    id: string;
    quote_number: number;
    customer_id: string;
    status: QuoteStatus;
    validity_date: string | null;
    customer_notes: string | null;
    internal_notes: string | null;
    template_id: string | null;
    sent_at: string | null;
    created_at: string;
    public_token: string | null;
    customers: { name: string };
  };
  const q = quote as unknown as QuoteRow;

  const [linesRes, templatesRes, attachmentsRes] = await Promise.all([
    supabase
      .from("quote_lines")
      .select(
        "id, position, part_id, qty, unit_price, ai_suggested_price, ai_reasoning, override_reason, line_notes_internal, line_notes_customer, parts(internal_pn, description, target_margin_pct)",
      )
      .eq("quote_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("pdf_templates")
      .select("id, name, is_default")
      .order("name", { ascending: true }),
    supabase
      .from("quote_attachments")
      .select("id, drive_file_id, name, mime_type")
      .eq("quote_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (linesRes.error) throw new Error(linesRes.error.message);
  if (templatesRes.error) throw new Error(templatesRes.error.message);
  if (attachmentsRes.error) throw new Error(attachmentsRes.error.message);

  type LineRow = {
    id: string;
    position: number;
    part_id: string | null;
    qty: number;
    unit_price: number | null;
    ai_suggested_price: number | null;
    ai_reasoning: string | null;
    override_reason: string | null;
    line_notes_internal: string | null;
    line_notes_customer: string | null;
    parts: {
      internal_pn: string;
      description: string | null;
      target_margin_pct: number | string | null;
    } | null;
  };

  const linesRaw = (linesRes.data ?? []) as unknown as LineRow[];

  // Vendor recommendations: for every distinct part_id in the lines, find the
  // 3 cheapest vendor_quotes ordered by quoted_at desc as tiebreaker.
  const partIds = [
    ...new Set(linesRaw.map((l) => l.part_id).filter((x): x is string => !!x)),
  ];

  const recsByPart = new Map<string, VendorRecommendation[]>();
  if (partIds.length > 0) {
    const { data: vqData } = await supabase
      .from("vendor_quotes")
      .select(
        "part_id, vendor_id, unit_price, lead_time_days, quoted_at, vendors!inner(name)",
      )
      .in("part_id", partIds)
      .order("quoted_at", { ascending: false });

    type VqRow = {
      part_id: string | null;
      vendor_id: string;
      unit_price: number;
      lead_time_days: number | null;
      quoted_at: string;
      vendors: { name: string };
    };

    const grouped = new Map<string, VendorRecommendation[]>();
    (vqData as unknown as VqRow[] | null)?.forEach((r) => {
      if (!r.part_id) return;
      if (!grouped.has(r.part_id)) grouped.set(r.part_id, []);
      grouped.get(r.part_id)!.push({
        vendor_id: r.vendor_id,
        vendor_name: r.vendors.name,
        unit_price: r.unit_price,
        lead_time_days: r.lead_time_days,
        quoted_at: r.quoted_at,
      });
    });

    // Sort each part's vendors by price asc; cap at 3.
    grouped.forEach((list, partId) => {
      const sorted = [...list].sort((a, b) => a.unit_price - b.unit_price);
      recsByPart.set(partId, sorted.slice(0, 3));
    });
  }

  const lines: QuoteLineDetail[] = linesRaw.map((l) => {
    const recs = l.part_id ? recsByPart.get(l.part_id) ?? [] : [];
    return {
      id: l.id,
      position: l.position,
      part_id: l.part_id,
      part_internal_pn: l.parts?.internal_pn ?? null,
      part_description: l.parts?.description ?? null,
      part_target_margin_pct:
        l.parts?.target_margin_pct != null
          ? Number(l.parts.target_margin_pct)
          : null,
      qty: l.qty,
      unit_price: l.unit_price,
      ai_suggested_price: l.ai_suggested_price,
      ai_reasoning: l.ai_reasoning,
      override_reason: l.override_reason,
      line_notes_internal: l.line_notes_internal,
      line_notes_customer: l.line_notes_customer,
      recommended_vendor: recs[0] ?? null,
      alt_vendors: recs.slice(1),
    };
  });

  return {
    quote: {
      id: q.id,
      quote_number: q.quote_number,
      customer_id: q.customer_id,
      customer_name: q.customers.name,
      status: q.status,
      validity_date: q.validity_date,
      customer_notes: q.customer_notes,
      internal_notes: q.internal_notes,
      template_id: q.template_id,
      sent_at: q.sent_at,
      created_at: q.created_at,
      public_token: q.public_token,
    },
    templates: templatesRes.data ?? [],
    lines,
    attachments: attachmentsRes.data ?? [],
  };
}

export type PartHistoryRow = {
  quote_line_id: string;
  quote_id: string;
  quote_number: number;
  customer_name: string;
  created_at: string;
  qty: number;
  unit_price: number | null;
};

export async function getPartHistory(partId: string): Promise<{
  history: PartHistoryRow[];
  latest_vendor: VendorRecommendation | null;
}> {
  const supabase = createClient();

  const [linesRes, vqRes] = await Promise.all([
    supabase
      .from("quote_lines")
      .select(
        "id, qty, unit_price, created_at, quotes!inner(id, quote_number, customers!inner(name))",
      )
      .eq("part_id", partId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("vendor_quotes")
      .select(
        "vendor_id, unit_price, lead_time_days, quoted_at, vendors!inner(name)",
      )
      .eq("part_id", partId)
      .order("quoted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (linesRes.error) throw new Error(linesRes.error.message);
  // vqRes.error is fine; no rows is not an error here.

  type LineRow = {
    id: string;
    qty: number;
    unit_price: number | null;
    created_at: string;
    quotes: {
      id: string;
      quote_number: number;
      customers: { name: string };
    };
  };

  const history: PartHistoryRow[] = ((linesRes.data ?? []) as unknown as LineRow[]).map(
    (r) => ({
      quote_line_id: r.id,
      quote_id: r.quotes.id,
      quote_number: r.quotes.quote_number,
      customer_name: r.quotes.customers.name,
      created_at: r.created_at,
      qty: r.qty,
      unit_price: r.unit_price,
    }),
  );

  type VqRow = {
    vendor_id: string;
    unit_price: number;
    lead_time_days: number | null;
    quoted_at: string;
    vendors: { name: string };
  } | null;

  const vq = vqRes.data as unknown as VqRow;
  const latest_vendor: VendorRecommendation | null = vq
    ? {
        vendor_id: vq.vendor_id,
        vendor_name: vq.vendors.name,
        unit_price: vq.unit_price,
        lead_time_days: vq.lead_time_days,
        quoted_at: vq.quoted_at,
      }
    : null;

  return { history, latest_vendor };
}

export type PartSearchResult = {
  id: string;
  internal_pn: string;
  description: string | null;
  matched_alias: string | null;
};

export async function searchPartsForLine(
  q: string,
): Promise<PartSearchResult[]> {
  if (!q.trim()) return [];
  const supabase = createClient();
  const like = `%${q.trim()}%`;

  const [partsRes, aliasesRes] = await Promise.all([
    supabase
      .from("parts")
      .select("id, internal_pn, description")
      .is("deleted_at", null)
      .or(`internal_pn.ilike.${like},description.ilike.${like}`)
      .limit(20),
    supabase
      .from("part_aliases")
      .select("part_id, alias_pn")
      .ilike("alias_pn", like)
      .limit(20),
  ]);

  const seen = new Map<string, PartSearchResult>();
  partsRes.data?.forEach((p) => {
    seen.set(p.id, {
      id: p.id,
      internal_pn: p.internal_pn,
      description: p.description,
      matched_alias: null,
    });
  });

  // Fetch part rows for alias matches that didn't already match by PN
  const aliasPartIds = (aliasesRes.data ?? [])
    .map((a) => a.part_id)
    .filter((id) => !seen.has(id));
  if (aliasPartIds.length > 0) {
    const { data: aliasParts } = await supabase
      .from("parts")
      .select("id, internal_pn, description")
      .in("id", aliasPartIds)
      .is("deleted_at", null);
    const aliasMap = new Map(
      (aliasesRes.data ?? []).map((a) => [a.part_id, a.alias_pn]),
    );
    aliasParts?.forEach((p) => {
      seen.set(p.id, {
        id: p.id,
        internal_pn: p.internal_pn,
        description: p.description,
        matched_alias: aliasMap.get(p.id) ?? null,
      });
    });
  }

  return [...seen.values()].slice(0, 15);
}
