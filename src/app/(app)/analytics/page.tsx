import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { getAnalytics } from "./queries";

const RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
  { label: "365d", days: 365 },
] as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const range = Number(searchParams.range) || 90;
  const data = await getAnalytics(range);

  const maxDayCount = Math.max(
    1,
    ...data.per_day.map((d) => d.sent + d.won + d.lost),
  );

  return (
    <div className="px-8 py-8 space-y-8 max-w-7xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quote activity over the last {data.range_days} days.
          </p>
        </div>
        <div className="inline-flex rounded-full border overflow-hidden">
          {RANGES.map((r) => (
            <Link
              key={r.label}
              href={`/analytics?range=${r.days}`}
              className={`px-3 py-1.5 text-xs ${
                r.days === range
                  ? "bg-brand-gradient text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Stat label="Drafted" value={data.totals.drafted.toLocaleString()} />
        <Stat label="Sent" value={data.totals.sent.toLocaleString()} />
        <Stat label="Won" value={data.totals.won.toLocaleString()} />
        <Stat
          label="Win rate"
          value={`${data.totals.win_rate_pct}%`}
          subtitle={`${data.totals.won} / ${data.totals.won + data.totals.lost} decided`}
        />
        <Stat
          label="Won total"
          value={formatMoney(data.totals.won_total_usd)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">
          Daily activity
        </h2>
        <div className="rounded-xl border bg-card p-4">
          {data.per_day.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No quote activity in this window.
            </p>
          ) : (
            <div className="flex items-end gap-0.5 h-32">
              {data.per_day.map((d) => {
                const total = d.sent + d.won + d.lost;
                const h = (total / maxDayCount) * 100;
                return (
                  <div
                    key={d.date}
                    className="flex-1 group relative flex flex-col justify-end"
                  >
                    <div
                      className="bg-brand-gradient rounded-sm transition-opacity hover:opacity-80"
                      style={{ height: `${h}%` }}
                    />
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border rounded-md px-2 py-1 text-[10px] whitespace-nowrap shadow-md z-10">
                      {d.date}: {total} ({d.won}W / {d.lost}L)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Top customers by won $
          </h2>
          <div className="rounded-xl border bg-card overflow-hidden">
            {data.top_customers.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No customers have won quotes in this window.
              </div>
            ) : (
              <ul className="divide-y">
                {data.top_customers.map((c) => (
                  <li key={c.customer_id}>
                    <Link
                      href={`/customers/${c.customer_id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {c.customer_name}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {c.won_count} won · {c.quote_count} total quotes
                        </div>
                      </div>
                      <div className="text-sm tabular-nums font-medium">
                        {formatMoney(c.won_total_usd)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Why we lost quotes
          </h2>
          <div className="rounded-xl border bg-card overflow-hidden">
            {data.loss_reasons.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No lost quotes in this window. 🎉
              </div>
            ) : (
              <ul className="divide-y">
                {data.loss_reasons.map((r) => {
                  const max = data.loss_reasons[0].count;
                  const pct = (r.count / max) * 100;
                  return (
                    <li
                      key={r.reason}
                      className="px-4 py-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{r.reason}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-brand-gradient"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <Badge variant="outline" className="tabular-nums shrink-0">
                        {r.count}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums mt-1">{value}</div>
      {subtitle && (
        <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
          {subtitle}
        </div>
      )}
    </div>
  );
}
