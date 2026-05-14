import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCustomerDetail } from "../queries";
import { CustomerForm } from "./components/customer-form";
import { ContactsEditor } from "./components/contacts-editor";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatMoney(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getCustomerDetail(params.id);
  if (!detail) notFound();

  return (
    <div className="px-6 py-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-sm text-muted-foreground gap-1">
          <Link href="/customers" className="hover:underline">
            Customers
          </Link>
          <span>›</span>
          <span className="text-foreground font-medium">
            {detail.customer.name}
          </span>
        </div>
        <Link
          href={`/quotes/new?customer=${detail.customer.id}`}
          className={cn(buttonVariants(), "h-10 rounded-full px-5")}
        >
          <Plus className="size-4 mr-1.5" />
          New quote
        </Link>
      </div>

      <CustomerForm initial={detail.customer} />

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Contacts</h2>
        <ContactsEditor
          customerId={detail.customer.id}
          initial={detail.contacts}
        />
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Recent quotes
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Quote</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px]">Created</TableHead>
                <TableHead className="w-[80px] text-right">Lines</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.recentQuotes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    No quotes yet
                  </TableCell>
                </TableRow>
              ) : (
                detail.recentQuotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium text-sm">
                      {q.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {formatDate(q.created_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {q.line_count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatMoney(q.total)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/quotes/${q.id}`}
                        className="text-sm text-muted-foreground hover:underline"
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
