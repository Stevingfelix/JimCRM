import Link from "next/link";
import { Download, Upload } from "lucide-react";
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
import { listParts } from "./queries";
import { PartsSearch } from "./components/parts-search";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function PartsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const [{ rows, total, pageSize }, saved] = await Promise.all([
    listParts({ q: searchParams.q, page }),
    getSavedSearches("parts"),
  ]);

  const buildHref = (p: number): string => {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/parts?${qs}` : "/parts";
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl">
      <div className="rounded-xl border bg-card">
        {/* Header bar: title + search + actions */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 px-4 sm:px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight shrink-0">
            Parts catalog
          </h2>
          <div className="flex-1 min-w-0">
            <PartsSearch />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/api/export/parts"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-4 text-sm hover:bg-muted transition-colors"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </a>
            <Link
              href="/parts/import"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-4 text-sm hover:bg-muted transition-colors"
            >
              <Upload className="size-3.5" />
              <span className="hidden sm:inline">Import CSV</span>
            </Link>
            <SavedSearchesMenu
              routeKey="parts"
              routeBase="/parts"
              initial={saved}
            />
          </div>
        </div>

        <div className="border-t min-h-[420px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Internal PN</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px] text-right">Aliases</TableHead>
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
                    {searchParams.q
                      ? `No parts match "${searchParams.q}"`
                      : "No parts yet — create one to get started"}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <Link
                        href={`/parts/${row.id}`}
                        className="hover:underline"
                      >
                        {row.internal_pn}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[600px] truncate">
                      {row.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.alias_count || "—"}
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
          unitSingular="part"
          unitPlural="parts"
        />
      </div>
    </div>
  );
}
