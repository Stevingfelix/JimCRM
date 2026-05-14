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
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-7xl">
      <div className="rounded-2xl border border-foreground/[0.06] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* Header bar: title + search + filter + export. Stacks on mobile,
            single row from md+. */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 px-6 sm:px-8 py-6">
          <h2 className="text-base font-semibold tracking-tight shrink-0">
            Active Customers
          </h2>
          <CustomersSearch />
          <a
            href="/api/export/customers"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-foreground/10 bg-background px-5 text-sm hover:bg-muted transition-colors shrink-0"
          >
            <Download className="size-3.5" />
            <span className="whitespace-nowrap">Export as CSV</span>
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
