import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCustomers } from "./queries";
import { CustomersSearch } from "./components/customers-search";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { rows, total } = await listCustomers({ q: searchParams.q, page });

  return (
    <div className="px-8 py-8 space-y-5 max-w-7xl">
      <p className="text-sm text-muted-foreground">
        {total.toLocaleString()} {total === 1 ? "customer" : "customers"}
      </p>

      <CustomersSearch />

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-[280px]">Primary contact</TableHead>
              <TableHead className="w-[100px] text-right">Quotes</TableHead>
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
                    ? `No customers match "${searchParams.q}"`
                    : "No customers yet"}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <Link
                      href={`/customers/${row.id}`}
                      className="hover:underline"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.primary_email ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.quote_count || "—"}
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
