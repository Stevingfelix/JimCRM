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
import { getVendorDetail } from "../queries";
import { VendorForm } from "./components/vendor-form";
import { VendorContactsEditor } from "./components/vendor-contacts-editor";
import { LogVendorQuoteDialog } from "./components/log-vendor-quote-dialog";

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatPrice(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function VendorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getVendorDetail(params.id);
  if (!detail) notFound();

  return (
    <div className="px-6 py-6 space-y-6 max-w-5xl">
      <div className="flex items-center text-sm text-muted-foreground gap-1">
        <Link href="/vendors" className="hover:underline">
          Vendors
        </Link>
        <span>›</span>
        <span className="text-foreground font-medium">
          {detail.vendor.name}
        </span>
      </div>

      <VendorForm initial={detail.vendor} />

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Contacts</h2>
        <VendorContactsEditor
          vendorId={detail.vendor.id}
          initial={detail.contacts}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Recent vendor quotes (cost basis)
            </h2>
            <p className="text-xs text-muted-foreground">
              Last 15 entries. Vendor pricing feeds the AI price suggester on
              customer quotes.
            </p>
          </div>
          <LogVendorQuoteDialog vendorId={detail.vendor.id} />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Part</TableHead>
                <TableHead className="w-[80px] text-right">Qty</TableHead>
                <TableHead className="w-[120px] text-right">
                  Unit cost
                </TableHead>
                <TableHead className="w-[110px]">Lead time</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.recentVendorQuotes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    No vendor quotes logged yet
                  </TableCell>
                </TableRow>
              ) : (
                detail.recentVendorQuotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(q.quoted_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {q.part_id && q.part_internal_pn ? (
                        <Link
                          href={`/parts/${q.part_id}`}
                          className="hover:underline"
                        >
                          {q.part_internal_pn}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {q.qty ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatPrice(q.unit_price)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {q.lead_time_days != null
                        ? `${q.lead_time_days} days`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {q.source_note ?? "—"}
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
