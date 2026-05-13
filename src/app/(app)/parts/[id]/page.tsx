import Link from "next/link";
import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPartDetail } from "../queries";
import { PartForm } from "./components/part-form";
import { AliasesEditor } from "./components/aliases-editor";

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatPrice(n: number | null): string {
  if (n === null) return "—";
  return `$${n.toFixed(2)}`;
}

export default async function PartDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getPartDetail(params.id);
  if (!detail) notFound();

  return (
    <div className="px-6 py-6 space-y-6 max-w-5xl">
      <div className="flex items-center text-sm text-muted-foreground gap-1">
        <Link href="/parts" className="hover:underline">
          Parts
        </Link>
        <span>›</span>
        <span className="text-foreground font-medium">
          {detail.part.internal_pn}
        </span>
      </div>

      <PartForm initial={detail.part} />

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Aliases</h2>
        <p className="text-xs text-muted-foreground">
          Alternate part numbers used by customers, manufacturers, or vendors.
          Searched when matching inbound quote requests.
        </p>
        <AliasesEditor partId={detail.part.id} initial={detail.aliases} />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Recent quote history (last 10)
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="w-[100px] text-right">Qty</TableHead>
                <TableHead className="w-[120px] text-right">
                  Unit price
                </TableHead>
                <TableHead className="w-[120px]">Quote</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.history.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    No quote history for this part yet
                  </TableCell>
                </TableRow>
              ) : (
                detail.history.map((row) => (
                  <TableRow key={row.quote_line_id}>
                    <TableCell className="tabular-nums text-sm">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/customers/${row.customer_id}`}
                        className="hover:underline"
                      >
                        {row.customer_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.qty}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatPrice(row.unit_price)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/quotes/${row.quote_id}`}
                        className="text-muted-foreground hover:underline"
                      >
                        open ↗
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
