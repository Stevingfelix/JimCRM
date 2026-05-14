import { Download } from "lucide-react";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SavedSearchesMenu } from "@/components/saved-searches-menu";
import { ListFooter } from "@/components/list-footer";
import { getSavedSearches } from "@/app/(app)/saved-searches/actions";
import {
  listQuotes,
  getQuotesOverview,
  type QuoteStatus,
} from "./queries";
import { QuotesFilters } from "./components/quotes-filters";
import { QuotesListBody } from "./components/quotes-list-body";
import { QuotesOverviewTiles } from "./components/quotes-overview";
import { QuotesStatusTabs } from "./components/quotes-status-tabs";

const STATUS_VALUES = new Set([
  "draft",
  "sent",
  "won",
  "lost",
  "expired",
]);

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const status =
    searchParams.status && STATUS_VALUES.has(searchParams.status)
      ? (searchParams.status as QuoteStatus)
      : null;
  const { rows, total, pageSize } = await listQuotes({
    q: searchParams.q,
    status,
    page,
  });
  const [saved, overview] = await Promise.all([
    getSavedSearches("quotes"),
    getQuotesOverview(),
  ]);

  const buildHref = (p: number): string => {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.status) params.set("status", searchParams.status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/quotes?${qs}` : "/quotes";
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 max-w-7xl">
      <QuotesOverviewTiles overview={overview} />

      <div className="rounded-2xl border border-foreground/[0.06] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* Tabs + actions row */}
        <div className="flex items-center justify-between gap-3 px-6 sm:px-8 pt-4">
          <QuotesStatusTabs />
        </div>

        {/* Search + count + saved + export row */}
        <div className="flex items-center justify-between gap-3 px-6 sm:px-8 py-5 border-b border-foreground/[0.06]">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <QuotesFilters />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SavedSearchesMenu
              routeKey="quotes"
              routeBase="/quotes"
              initial={saved}
            />
            <a
              href="/api/export/csv"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-foreground/10 bg-background px-5 text-sm hover:bg-muted transition-colors"
            >
              <Download className="size-3.5" />
              Export CSV
            </a>
          </div>
        </div>

        <div className="min-h-[460px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Quote</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px]">Created</TableHead>
                <TableHead className="w-[120px]">Validity</TableHead>
                <TableHead className="w-[80px] text-right">Lines</TableHead>
                <TableHead className="w-[120px] text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <QuotesListBody
              rows={rows}
              emptyMessage={
                searchParams.q || searchParams.status
                  ? "No quotes match the current filter"
                  : "No quotes yet — create one to get started"
              }
            />
          </Table>
        </div>

        <ListFooter
          page={page}
          pageSize={pageSize}
          total={total}
          buildHref={buildHref}
          unitSingular="quote"
          unitPlural="quotes"
        />
      </div>
    </div>
  );
}
