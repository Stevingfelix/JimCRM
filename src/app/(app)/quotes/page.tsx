import { Download } from "lucide-react";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SavedSearchesMenu } from "@/components/saved-searches-menu";
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
  const [{ rows, total }, saved, overview] = await Promise.all([
    listQuotes({
      q: searchParams.q,
      status,
      page,
    }),
    getSavedSearches("quotes"),
    getQuotesOverview(),
  ]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 max-w-7xl">
      <QuotesOverviewTiles overview={overview} />

      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Tabs + actions row */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <QuotesStatusTabs />
        </div>

        {/* Search + count + saved + export row */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <QuotesFilters />
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {total.toLocaleString()} {total === 1 ? "result" : "results"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SavedSearchesMenu
              routeKey="quotes"
              routeBase="/quotes"
              initial={saved}
            />
            <a
              href="/api/export/csv"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-4 text-sm hover:bg-muted transition-colors"
            >
              <Download className="size-3.5" />
              Export CSV
            </a>
          </div>
        </div>

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
    </div>
  );
}
