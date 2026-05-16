import Link from "next/link";
import {
  Inbox,
  FileText,
  Clock,
  Wallet,
  Receipt,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SetupBanner } from "@/components/setup-banner";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import { getCompanyInfo } from "@/lib/company";
import { getDashboardData } from "./dashboard-queries";
import { getReorderHints } from "./reorder-queries";

// Things we consider required for a "complete" business setup.
function missingSetup(c: Awaited<ReturnType<typeof getCompanyInfo>>): string[] {
  const out: string[] = [];
  if (!c.logo_url) out.push("logo");
  if (
    !c.company_name ||
    c.company_name === "My Company" ||
    c.company_name === "CAP Hardware Supply"
  )
    out.push("company name");
  if (!c.contact_email) out.push("contact email");
  if (!c.address) out.push("address");
  return out;
}

export default async function DashboardPage() {
  const [data, reorderHints, company] = await Promise.all([
    getDashboardData(),
    getReorderHints(8),
    getCompanyInfo(),
  ]);

  const missing = missingSetup(company);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 max-w-7xl">
      <SetupBanner missing={missing} />

      {/* QUOTING OVERVIEW */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            Quoting Overview
          </h2>
          <span className="text-xs text-muted-foreground">Last 7 days</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            icon={<DollarSign className="size-4" />}
            label="Quoted this month"
            value={`$${data.kpis.quoted_this_month.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            subline={new Date().toLocaleString("default", { month: "long" })}
            tone="primary"
            href="/quotes"
          />
          <KpiCard
            icon={<Trophy className="size-4" />}
            label="Win rate"
            value={
              data.kpis.win_rate != null
                ? `${data.kpis.win_rate}%`
                : "—"
            }
            subline={
              data.kpis.win_rate != null
                ? data.kpis.win_rate >= 50
                  ? "Looking strong"
                  : "Room to improve"
                : "No won/lost quotes yet"
            }
            href="/quotes?status=won"
          />
          <KpiCard
            icon={<Wallet className="size-4" />}
            label="Sent this week"
            value={data.kpis.sent_this_week}
            subline={
              data.kpis.sent_this_week === 0
                ? "No quotes sent in period"
                : `${data.kpis.sent_this_week} quote${data.kpis.sent_this_week === 1 ? "" : "s"} out the door`
            }
            href="/quotes?status=sent"
          />
          <KpiCard
            icon={<Receipt className="size-4" />}
            label="Drafts in progress"
            value={data.kpis.drafts_in_progress}
            subline={
              data.kpis.drafts_in_progress === 0
                ? "No drafts open"
                : "Pick up where you left off"
            }
            href="/quotes?status=draft"
          />
          <KpiCard
            icon={<TrendingUp className="size-4" />}
            label="Parts in catalog"
            value={data.kpis.parts_in_catalog}
            subline="Total active SKUs"
            href="/parts"
          />
          <KpiCard
            icon={<AlertCircle className="size-4" />}
            label="Pending review"
            value={data.kpis.pending_review}
            subline={
              data.kpis.pending_review === 0
                ? "Review queue is clear"
                : "Inbound emails awaiting action"
            }
            tone={data.kpis.pending_review > 0 ? "primary" : "default"}
            href="/review"
          />
        </div>
      </section>

      {/* NEEDS ATTENTION */}
      {(data.attention.expiring_soon.length > 0 ||
        data.attention.stale_sent.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Needs attention
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.attention.expiring_soon.length > 0 && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
                  Expiring within 7 days
                </div>
                <ul className="divide-y">
                  {data.attention.expiring_soon.map((q) => (
                    <li key={q.id}>
                      <Link
                        href={`/quotes/${q.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-medium tabular-nums">
                            {formatQuoteNumber(q.quote_number)}
                          </span>
                          <span className="text-sm text-muted-foreground ml-2 truncate">
                            {q.customer_name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm tabular-nums font-medium">
                            {q.total != null ? formatMoney(q.total) : "—"}
                          </div>
                          <div className="text-[10px] text-amber-600 tabular-nums">
                            expires {formatDate(q.validity_date)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.attention.stale_sent.length > 0 && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20">
                  Awaiting response 3+ days
                </div>
                <ul className="divide-y">
                  {data.attention.stale_sent.map((q) => (
                    <li key={q.id}>
                      <Link
                        href={`/quotes/${q.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-medium tabular-nums">
                            {formatQuoteNumber(q.quote_number)}
                          </span>
                          <span className="text-sm text-muted-foreground ml-2 truncate">
                            {q.customer_name}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-rose-200 text-rose-600 tabular-nums shrink-0"
                        >
                          {q.days_ago}d ago
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* REORDER REMINDERS */}
      {reorderHints.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">
              Reorder reminders
            </h2>
            <span className="text-xs text-muted-foreground">
              Customers overdue for parts they regularly buy.
            </span>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            <ul className="divide-y">
              {reorderHints.map((h) => (
                <li key={`${h.customer_id}::${h.part_id}`}>
                  <Link
                    href={`/customers/${h.customer_id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {h.customer_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        usually orders{" "}
                        <code className="text-foreground">{h.internal_pn}</code>{" "}
                        every ~{h.avg_interval_days} days · last:{" "}
                        {formatDate(h.last_quote_at)} ({h.days_since_last}d ago)
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-200 tabular-nums shrink-0"
                    >
                      +{h.overdue_days}d overdue
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* RECENT ACTIVITY GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Recent quotes"
          emptyIcon={<FileText className="size-5" />}
          emptyText="No quotes yet"
          href="/quotes"
        >
          {data.recent_quotes.length > 0 && (
            <ul className="divide-y">
              {data.recent_quotes.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/quotes/${q.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums text-sm">
                          {formatQuoteNumber(q.quote_number)}
                        </span>
                        <Badge variant="outline" className="capitalize text-xs">
                          {q.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {q.customer_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm tabular-nums font-medium">
                        {q.total != null ? formatMoney(q.total) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {formatDate(q.created_at)} · {q.line_count} line
                        {q.line_count === 1 ? "" : "s"}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Pending review"
          emptyIcon={<Inbox className="size-5" />}
          emptyText="Review queue is clear"
          href="/review"
        >
          {data.recent_review.length > 0 && (
            <ul className="divide-y">
              {data.recent_review.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/review/${e.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {e.subject ?? "(no subject)"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {e.sender_email ?? "—"}
                        {e.source_type && (
                          <>
                            {" · "}
                            <span className="capitalize">
                              {e.source_type.replace(/_/g, " ")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {formatDate(e.received_at)}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {e.line_count} line{e.line_count === 1 ? "" : "s"}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subline,
  tone = "default",
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subline: string;
  tone?: "default" | "primary";
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted-foreground tracking-wide font-medium uppercase">
          {label}
        </div>
        <div
          className={`inline-flex items-center justify-center size-7 rounded-lg ${
            tone === "primary"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </div>
      </div>
      <div className="text-3xl font-semibold tabular-nums mt-3 tracking-tight">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-xs text-muted-foreground mt-1.5">{subline}</div>
    </Link>
  );
}

function Card({
  title,
  emptyIcon,
  emptyText,
  href,
  children,
}: {
  title: string;
  emptyIcon: React.ReactNode;
  emptyText: string;
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Link
          href={href}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          view all →
        </Link>
      </div>
      {children ?? (
        <div className="px-4 py-10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <div className="size-10 rounded-full bg-muted grid place-items-center">
            {emptyIcon}
          </div>
          <div className="text-sm">{emptyText}</div>
        </div>
      )}
    </div>
  );
}

