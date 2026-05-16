import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import { CustomerActions } from "./components/customer-actions";

// Public quote-view page. Anyone with the token sees a read-only quote
// summary + can click Accept / Reject. No auth — bypasses RLS via the
// service-role admin client.
export const dynamic = "force-dynamic";

export default async function PublicQuotePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, status, validity_date, customer_notes, created_at, customers!inner(name), quote_lines(position, qty, unit_price, line_notes_customer, parts(internal_pn, short_description))",
    )
    .eq("public_token", params.token)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) notFound();

  type QuoteRow = {
    id: string;
    quote_number: number;
    status: string;
    validity_date: string | null;
    customer_notes: string | null;
    created_at: string;
    customers: { name: string };
    quote_lines: Array<{
      position: number;
      qty: number;
      unit_price: number | null;
      line_notes_customer: string | null;
      parts: { internal_pn: string; short_description: string | null } | null;
    }>;
  };
  const q = data as unknown as QuoteRow;
  const lines = [...q.quote_lines].sort((a, b) => a.position - b.position);
  const subtotal = lines.reduce<number | null>((acc, l) => {
    if (l.unit_price == null) return acc;
    return (acc ?? 0) + l.qty * l.unit_price;
  }, null);

  const isTerminal = ["won", "lost", "expired"].includes(q.status);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-brand-gradient text-primary-foreground grid place-items-center font-bold text-lg shadow-sm">
              C
            </div>
            <div>
              <div className="font-semibold tracking-tight">
                CAP Hardware Supply
              </div>
              <div className="text-xs text-muted-foreground">
                Industrial fasteners &amp; hardware
              </div>
            </div>
          </div>
          <Link
            href={`/api/quotes/${q.id}/pdf`}
            target="_blank"
            className="inline-flex h-10 items-center rounded-full border bg-card px-5 text-sm hover:bg-muted"
          >
            Download PDF
          </Link>
        </header>

        <div className="rounded-2xl border bg-card p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Quote for
              </div>
              <div className="text-lg font-semibold tracking-tight">
                {q.customers.name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                {formatQuoteNumber(q.quote_number)}
              </div>
              <div className="text-sm tabular-nums">
                {formatDate(q.created_at)}
              </div>
              {q.validity_date && (
                <div className="text-xs text-muted-foreground tabular-nums">
                  Valid through {formatDate(q.validity_date)}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left w-12">#</th>
                  <th className="px-4 py-2 text-left">Part</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Unit</th>
                  <th className="px-4 py-2 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l, idx) => {
                  const total =
                    l.unit_price != null ? l.qty * l.unit_price : null;
                  return (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">
                          {l.parts?.internal_pn ?? "—"}
                        </div>
                        {l.parts?.short_description && (
                          <div className="text-xs text-muted-foreground">
                            {l.parts.short_description}
                          </div>
                        )}
                        {l.line_notes_customer && (
                          <div className="text-xs text-muted-foreground italic mt-0.5">
                            {l.line_notes_customer}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {l.qty}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatMoney(l.unit_price)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {formatMoney(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td colSpan={4} className="px-4 py-3 text-right text-sm">
                    Subtotal
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {formatMoney(subtotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {q.customer_notes && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">
                Notes
              </div>
              <p className="text-sm leading-relaxed">{q.customer_notes}</p>
            </div>
          )}
        </div>

        {isTerminal ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <div className="text-sm font-medium capitalize">{q.status}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Thanks — this quote has been marked as{" "}
              <span className="capitalize">{q.status}</span>. Get in touch if
              anything needs to change.
            </div>
          </div>
        ) : (
          <CustomerActions token={params.token} />
        )}

        <p className="text-xs text-muted-foreground text-center">
          Questions about this quote? Reply to the email it came in, or contact
          us at info@caphardware.com.
        </p>
      </div>
    </div>
  );
}
