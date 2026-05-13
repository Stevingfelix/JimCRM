import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import { listQuotes, type QuoteStatus } from "./queries";
import { QuotesFilters } from "./components/quotes-filters";
import { NewQuoteDialog } from "./components/new-quote-dialog";

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
  const { rows, total } = await listQuotes({
    q: searchParams.q,
    status,
    page,
  });

  return (
    <div className="px-8 py-8 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} total
          </p>
        </div>
        <NewQuoteDialog />
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
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  {searchParams.q || searchParams.status
                    ? "No quotes match the current filter"
                    : "No quotes yet — create one to get started"}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium tabular-nums">
                    <Link
                      href={`/quotes/${row.id}`}
                      className="hover:underline"
                    >
                      {formatQuoteNumber(row.quote_number)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link
                      href={`/customers/${row.customer_id}`}
                      className="hover:underline"
                    >
                      {row.customer_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(row.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(row.validity_date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.line_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatMoney(row.total)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
