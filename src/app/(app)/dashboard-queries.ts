import { createClient } from "@/lib/supabase/server";

export type DashboardData = {
  kpis: {
    pending_review: number;
    drafts_in_progress: number;
    sent_this_week: number;
    parts_in_catalog: number;
  };
  recent_quotes: Array<{
    id: string;
    quote_number: number;
    customer_name: string;
    status: string;
    created_at: string;
    line_count: number;
    total: number | null;
  }>;
  recent_review: Array<{
    id: string;
    subject: string | null;
    sender_email: string | null;
    received_at: string | null;
    source_type: string | null;
    line_count: number;
  }>;
};

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createClient();

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    pendingReviewRes,
    draftsRes,
    sentRes,
    partsRes,
    recentQuotesRes,
    recentReviewRes,
  ] = await Promise.all([
    supabase
      .from("email_events")
      .select("id", { count: "exact", head: true })
      .eq("needs_review", true),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .is("deleted_at", null),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", oneWeekAgo)
      .is("deleted_at", null),
    supabase
      .from("parts")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("quotes")
      .select(
        "id, quote_number, status, created_at, customers!inner(name), quote_lines(qty, unit_price)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("email_events")
      .select("id, parsed_payload, received_at")
      .eq("needs_review", true)
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(5),
  ]);

  type QuoteRow = {
    id: string;
    quote_number: number;
    status: string;
    created_at: string;
    customers: { name: string };
    quote_lines: Array<{ qty: number; unit_price: number | null }>;
  };

  type ReviewRow = {
    id: string;
    received_at: string | null;
    parsed_payload: {
      sender?: { email?: string | null };
      subject?: string | null;
      extraction?: { source_type?: string; lines?: unknown[] };
    } | null;
  };

  const recent_quotes = (
    (recentQuotesRes.data ?? []) as unknown as QuoteRow[]
  ).map((q) => ({
    id: q.id,
    quote_number: q.quote_number,
    customer_name: q.customers.name,
    status: q.status,
    created_at: q.created_at,
    line_count: q.quote_lines.length,
    total: q.quote_lines.reduce<number | null>((acc, l) => {
      if (l.unit_price == null) return acc;
      return (acc ?? 0) + l.qty * l.unit_price;
    }, null),
  }));

  const recent_review = (
    (recentReviewRes.data ?? []) as unknown as ReviewRow[]
  ).map((e) => ({
    id: e.id,
    subject: e.parsed_payload?.subject ?? null,
    sender_email: e.parsed_payload?.sender?.email ?? null,
    received_at: e.received_at,
    source_type: e.parsed_payload?.extraction?.source_type ?? null,
    line_count: e.parsed_payload?.extraction?.lines?.length ?? 0,
  }));

  return {
    kpis: {
      pending_review: pendingReviewRes.count ?? 0,
      drafts_in_progress: draftsRes.count ?? 0,
      sent_this_week: sentRes.count ?? 0,
      parts_in_catalog: partsRes.count ?? 0,
    },
    recent_quotes,
    recent_review,
  };
}
