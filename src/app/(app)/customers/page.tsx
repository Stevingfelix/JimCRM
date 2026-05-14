import { Download } from "lucide-react";
import { listCustomers, type CustomerFilter } from "./queries";
import { CustomersSearch } from "./components/customers-search";
import { CustomersTable } from "./components/customers-table";

const VALID_FILTERS: CustomerFilter[] = [
  "all",
  "with_quotes",
  "no_quotes",
  "with_wins",
];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; filter?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const filter: CustomerFilter =
    searchParams.filter &&
    (VALID_FILTERS as string[]).includes(searchParams.filter)
      ? (searchParams.filter as CustomerFilter)
      : "all";

  const { rows, total, pageSize } = await listCustomers({
    q: searchParams.q,
    filter,
    page,
  });

  const hasFilter = Boolean(searchParams.q) || filter !== "all";

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Header bar: title + search + filter + export */}
        <div className="flex items-center gap-4 flex-wrap px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight shrink-0">
            Active Customers
          </h2>
          <CustomersSearch />
          <a
            href="/api/export/customers"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-4 text-sm hover:bg-muted transition-colors shrink-0"
          >
            <Download className="size-3.5" />
            Export as CSV
          </a>
        </div>

        <CustomersTable
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          hasFilter={hasFilter}
        />
      </div>
    </div>
  );
}
