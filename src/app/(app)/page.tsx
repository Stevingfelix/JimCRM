import Link from "next/link";
import { Inbox, FileText, Send, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import { getDashboardData } from "./dashboard-queries";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="px-8 py-8 space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Status at a glance for CAP Hardware Supply.
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Inbox className="size-4" />}
          label="Pending review"
          value={data.kpis.pending_review}
          tone={data.kpis.pending_review > 0 ? "primary" : "muted"}
          href="/review"
        />
        <KpiCard
          icon={<FileText className="size-4" />}
          label="Drafts in progress"
          value={data.kpis.drafts_in_progress}
          href="/quotes?status=draft"
        />
        <KpiCard
          icon={<Send className="size-4" />}
          label="Sent this week"
          value={data.kpis.sent_this_week}
          href="/quotes?status=sent"
        />
        <KpiCard
          icon={<Package className="size-4" />}
          label="Parts in catalog"
          value={data.kpis.parts_in_catalog}
          href="/parts"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent quotes" emptyText="No quotes yet" href="/quotes">
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
                        {formatMoney(q.total)}
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
          emptyText="Review queue is clear ✨"
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
  tone = "default",
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "default" | "primary" | "muted";
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm"
    >
      <div
        className={`inline-flex items-center justify-center size-8 rounded-lg mb-3 ${
          tone === "primary"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">
        {value.toLocaleString()}
      </div>
    </Link>
  );
}

function Card({
  title,
  emptyText,
  href,
  children,
}: {
  title: string;
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
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}
    </div>
  );
}
