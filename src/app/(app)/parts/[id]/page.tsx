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
import { listPendingSuggestionsForPart } from "@/lib/alias-suggestions";
import { getPartDetail } from "../queries";
import { PartForm } from "./components/part-form";
import { AliasesEditor } from "./components/aliases-editor";
import { AliasSuggestionsCard } from "./components/alias-suggestions-card";
import { PartAttachmentsSection } from "./components/part-attachments-section";
import { PriceHistoryChart } from "./components/price-history-chart";

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
  const [detail, suggestions] = await Promise.all([
    getPartDetail(params.id),
    listPendingSuggestionsForPart(params.id),
  ]);
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

      {/* Spec summary — only non-null values */}
      {(() => {
        const specs: string[] = [];
        if (detail.part.thread_size) specs.push(`Thread: ${detail.part.thread_size}`);
        if (detail.part.length) specs.push(`Length: ${detail.part.length}`);
        if (detail.part.material) specs.push(`Material: ${detail.part.material}`);
        if (detail.part.finish) specs.push(`Finish: ${detail.part.finish}`);
        if (detail.part.grade) specs.push(`Grade: ${detail.part.grade}`);
        if (detail.part.head_type) specs.push(`Head: ${detail.part.head_type}`);
        if (detail.part.product_family) specs.push(`Family: ${detail.part.product_family}`);
        if (specs.length === 0) return null;
        return (
          <p className="text-sm text-muted-foreground">{specs.join(" \u00B7 ")}</p>
        );
      })()}

      <PartForm initial={detail.part} />

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Aliases</h2>
        <p className="text-xs text-muted-foreground">
          Alternate part numbers used by customers, manufacturers, or vendors.
          Searched when matching inbound quote requests.
        </p>
        <AliasSuggestionsCard
          partId={detail.part.id}
          suggestions={suggestions}
        />
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

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Price trend</h2>
        <PriceHistoryChart
          sellPrices={detail.history
            .filter((h) => h.unit_price !== null)
            .map((h) => ({
              date: h.created_at,
              price: h.unit_price as number,
              customer: h.customer_name,
            }))}
          costPrices={detail.vendor_price_history.map((v) => ({
            date: v.date,
            price: v.unit_price,
            vendor: v.vendor_name,
          }))}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Attachments</h2>
        <p className="text-xs text-muted-foreground">
          Spec sheets, photos, or any Drive file associated with this part.
        </p>
        <PartAttachmentsSection
          partId={detail.part.id}
          attachments={detail.attachments}
        />
      </section>
    </div>
  );
}
