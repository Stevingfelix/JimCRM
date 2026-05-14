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
import { SavedSearchesMenu } from "@/components/saved-searches-menu";
import { ListFooter } from "@/components/list-footer";
import { getSavedSearches } from "@/app/(app)/saved-searches/actions";
import { listVendors } from "./queries";
import { VendorsSearch } from "./components/vendors-search";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const [{ rows, total, pageSize, categories }, saved] = await Promise.all([
    listVendors({
      q: searchParams.q,
      category: searchParams.category,
      page,
    }),
    getSavedSearches("vendors"),
  ]);

  const buildHref = (p: number): string => {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.category) params.set("category", searchParams.category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/vendors?${qs}` : "/vendors";
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl">
      <div className="rounded-2xl border border-foreground/[0.06] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* Header bar */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 px-6 sm:px-8 py-6">
          <h2 className="text-base font-semibold tracking-tight shrink-0">
            Active Vendors
          </h2>
          <div className="flex-1 min-w-0">
            <VendorsSearch categories={categories} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SavedSearchesMenu
              routeKey="vendors"
              routeBase="/vendors"
              initial={saved}
            />
          </div>
        </div>

        <div className="border-t border-foreground/[0.06] min-h-[460px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead className="w-[130px] text-right">
                  Parts quoted
                </TableHead>
                <TableHead className="w-[130px]">Last quote</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground py-10"
                  >
                    {searchParams.q || searchParams.category
                      ? "No vendors match the current filter"
                      : "No vendors yet"}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <Link
                        href={`/vendors/${row.id}`}
                        className="hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.categories.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        ) : (
                          row.categories.map((c) => (
                            <Badge
                              key={c}
                              variant="secondary"
                              className="font-normal"
                            >
                              {c}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.parts_quoted || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {formatDate(row.last_quote_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <ListFooter
          page={page}
          pageSize={pageSize}
          total={total}
          buildHref={buildHref}
          unitSingular="vendor"
          unitPlural="vendors"
        />
      </div>
    </div>
  );
}
