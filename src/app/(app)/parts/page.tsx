import Link from "next/link";
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} {total === 1 ? "part" : "parts"}
        </p>
        <div className="flex items-center gap-2">
          <a
            href="/api/export/parts"
            className="inline-flex h-9 items-center rounded-full border bg-background px-4 text-sm hover:bg-muted transition-colors"
          >
            Export CSV
          </a>
          <Link
            href="/parts/import"
            className="inline-flex h-9 items-center rounded-full border bg-background px-4 text-sm hover:bg-muted transition-colors"
          >
            Import CSV
          </Link>
          <SavedSearchesMenu
            routeKey="parts"
            routeBase="/parts"
            initial={saved}
          />
        </div>
      </div>

      <PartsSearch />

      <div className="rounded-xl border bg-card overflow-hidden">
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
                  className="text-center text-sm text-muted-foreground py-8"
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

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} q={searchParams.q} />
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  q,
}: {
  page: number;
  totalPages: number;
  q?: string;
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/parts?${qs}` : "/parts";
  };

  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        className={`px-2 py-1 rounded ${
          page === 1
            ? "pointer-events-none text-muted-foreground"
            : "hover:bg-muted"
        }`}
      >
        ← prev
      </Link>
      <span className="text-muted-foreground tabular-nums">
        {page} / {totalPages}
      </span>
      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        className={`px-2 py-1 rounded ${
          page === totalPages
            ? "pointer-events-none text-muted-foreground"
            : "hover:bg-muted"
        }`}
      >
        next →
      </Link>
    </div>
  );
}
