import { createClient } from "@/lib/supabase/server";

export type AnalyticsData = {
  range_days: number;
  totals: {
    drafted: number;
    sent: number;
    won: number;
    lost: number;
    expired: number;
    win_rate_pct: number; // won / (won + lost), 0 if neither
    won_total_usd: number;
  };
  per_day: Array<{ date: string; sent: number; won: number; lost: number }>;
  top_customers: Array<{
    customer_id: string;
    customer_name: string;
    quote_count: number;
    won_count: number;
    won_total_usd: number;
  }>;
  loss_reasons: Array<{ reason: string; count: number }>;
};

export async function getAnalytics(rangeDays = 90): Promise<AnalyticsData> {
  const supabase = createClient();
  const since = new Date(
    Date.now() - rangeDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: quotes } = await supabase
    .from("quotes")
    .select(
      "id, status, created_at, outcome_at, outcome_reason, customer_id, customers!inner(name), quote_lines(qty, unit_price)",
    )
    .gte("created_at", since)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    status: string;
    created_at: string;
    outcome_at: string | null;
    outcome_reason: string | null;
    customer_id: string;
    customers: { name: string };
    quote_lines: Array<{ qty: number; unit_price: number | null }>;
  };
  const rows = (quotes ?? []) as unknown as Row[];

  const totals = {
    drafted: 0,
    sent: 0,
    won: 0,
    lost: 0,
    expired: 0,
    win_rate_pct: 0,
    won_total_usd: 0,
  };

  const perDay = new Map<
    string,
    { date: string; sent: number; won: number; lost: number }
  >();

  const byCustomer = new Map<
    string,
    {
      customer_id: string;
      customer_name: string;
      quote_count: number;
      won_count: number;
      won_total_usd: number;
    }
  >();

  const lossReasonCounts = new Map<string, number>();

  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    let pd = perDay.get(day);
    if (!pd) {
      pd = { date: day, sent: 0, won: 0, lost: 0 };
      perDay.set(day, pd);
    }

    const lineTotal = r.quote_lines.reduce<number>((acc, l) => {
      if (l.unit_price == null) return acc;
      return acc + l.qty * Number(l.unit_price);
    }, 0);

    if (r.status === "draft") totals.drafted++;
    if (r.status === "sent") {
      totals.sent++;
      pd.sent++;
    }
    if (r.status === "won") {
      totals.won++;
      totals.won_total_usd += lineTotal;
      pd.won++;
    }
    if (r.status === "lost") {
      totals.lost++;
      pd.lost++;
      // Strip the prefix label we added so we count the underlying reason.
      const reason =
        (r.outcome_reason ?? "Unspecified").split(" — ")[0] || "Unspecified";
      lossReasonCounts.set(reason, (lossReasonCounts.get(reason) ?? 0) + 1);
    }
    if (r.status === "expired") totals.expired++;

    let cust = byCustomer.get(r.customer_id);
    if (!cust) {
      cust = {
        customer_id: r.customer_id,
        customer_name: r.customers.name,
        quote_count: 0,
        won_count: 0,
        won_total_usd: 0,
      };
      byCustomer.set(r.customer_id, cust);
    }
    cust.quote_count++;
    if (r.status === "won") {
      cust.won_count++;
      cust.won_total_usd += lineTotal;
    }
  }

  const decided = totals.won + totals.lost;
  totals.win_rate_pct =
    decided > 0 ? Math.round((totals.won / decided) * 100) : 0;

  const top_customers = [...byCustomer.values()]
    .sort((a, b) => b.won_total_usd - a.won_total_usd || b.quote_count - a.quote_count)
    .slice(0, 10);

  const loss_reasons = [...lossReasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const per_day = [...perDay.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return {
    range_days: rangeDays,
    totals,
    per_day,
    top_customers,
    loss_reasons,
  };
}
