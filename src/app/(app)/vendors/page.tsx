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
import { getSavedSearches } from "@/app/(app)/saved-searches/actions";
import { listVendors } from "./queries";
import { VendorsSearch } from "./components/vendors-search";
import { NewVendorDialog } from "./components/new-vendor-dialog";

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
  const [{ rows, total, categories }, saved] = await Promise.all([
    listVendors({
      q: searchParams.q,
      category: searchParams.category,
      page,
    }),
    getSavedSearches("vendors"),
  ]);

  return (
    <div className="px-8 py-8 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SavedSearchesMenu
            routeKey="vendors"
            routeBase="/vendors"
            initial={saved}
          />
          <NewVendorDialog />
        </div>
      </div>

      <VendorsSearch categories={categories} />

      <div className="rounded-xl border bg-card overflow-hidden">
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
                  className="text-center text-sm text-muted-foreground py-8"
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
    </div>
  );
}
