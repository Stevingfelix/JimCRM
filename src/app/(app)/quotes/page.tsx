import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SavedSearchesMenu } from "@/components/saved-searches-menu";
import { getSavedSearches } from "@/app/(app)/saved-searches/actions";
import { listQuotes, type QuoteStatus } from "./queries";
import { QuotesFilters } from "./components/quotes-filters";
import { QuotesListBody } from "./components/quotes-list-body";

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
  const [{ rows, total }, saved] = await Promise.all([
    listQuotes({
      q: searchParams.q,
      status,
      page,
    }),
    getSavedSearches("quotes"),
  ]);

  return (
    <div className="px-8 py-8 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} {total === 1 ? "quote" : "quotes"}
        </p>
        <SavedSearchesMenu
          routeKey="quotes"
          routeBase="/quotes"
          initial={saved}
        />
      </div>

      <QuotesFilters />

      <div className="rounded-xl border bg-card overflow-hidden">
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
