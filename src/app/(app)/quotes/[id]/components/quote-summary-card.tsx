import type { CompanyInfo } from "@/lib/company";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import type { QuoteCustomerContact, QuoteLineDetail } from "../../queries";

type Props = {
  quote: {
    quote_number: number;
    customer_name: string;
    customer_billing_address: string | null;
    customer_primary_contact: QuoteCustomerContact | null;
    validity_date: string | null;
    created_at: string;
  };
  lines: QuoteLineDetail[];
  company: CompanyInfo;
};

export function QuoteSummaryCard({ quote, lines, company }: Props) {
  const subtotal = lines.reduce<number>((acc, l) => {
    if (l.unit_price == null) return acc;
    return acc + l.qty * l.unit_price;
  }, 0);

  return (
    <div className="rounded-2xl border bg-white dark:bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* ── Company header + QUOTE title ── */}
      <div className="px-8 pt-8 pb-6 flex items-start justify-between gap-8">
        <div className="space-y-1.5">
          {company.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_url}
              alt={company.company_name}
              className="h-8 w-auto mb-2"
            />
          ) : (
            <div className="text-lg font-semibold tracking-tight">
              {company.company_name}
            </div>
          )}
          {company.address && (
            <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {company.address}
            </div>
          )}
          <div className="text-sm text-muted-foreground space-y-0.5">
            {company.phone && <div>{company.phone}</div>}
            {company.tax_id && <div>Reg: {company.tax_id}</div>}
            {company.contact_email && <div>{company.contact_email}</div>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-4xl font-extralight tracking-[0.15em] text-muted-foreground/40 uppercase">
            Quote
          </div>
          <div className="text-base font-medium tabular-nums mt-1">
            {formatQuoteNumber(quote.quote_number)}
          </div>
        </div>
      </div>

      {/* ── Billed To + Dates + Amount Due ── */}
      <div className="px-8 pb-8 grid grid-cols-[1fr_auto_auto] gap-x-12 gap-y-1">
        {/* Billed to */}
        <div>
          <div className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground/60 uppercase mb-2">
            Billed To
          </div>
          <div className="text-sm font-semibold">{quote.customer_name}</div>
          {quote.customer_primary_contact?.email && (
            <div className="text-sm text-muted-foreground">
              {quote.customer_primary_contact.email}
            </div>
          )}
          {quote.customer_primary_contact?.phone && (
            <div className="text-sm text-muted-foreground">
              {quote.customer_primary_contact.phone}
            </div>
          )}
          {quote.customer_billing_address && (
            <div className="text-sm text-muted-foreground whitespace-pre-line mt-0.5">
              {quote.customer_billing_address}
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground/60 uppercase mb-1">
              Issue Date
            </div>
            <div className="text-sm tabular-nums">
              {formatDate(quote.created_at)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground/60 uppercase mb-1">
              Valid Until
            </div>
            <div className="text-sm tabular-nums">
              {quote.validity_date ? formatDate(quote.validity_date) : "—"}
            </div>
          </div>
        </div>

        {/* Amount due */}
        <div className="text-right">
          <div className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground/60 uppercase mb-1">
            Amount Due
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatMoney(subtotal)}
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-8">
        <div className="border-t" />
      </div>

      {/* ── Line items table ── */}
      {lines.length > 0 && (
        <div className="px-8 pt-4 pb-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground/60 uppercase">
                <th className="text-left py-3 pr-4">Description</th>
                <th className="text-right py-3 w-[110px]">Rate</th>
                <th className="text-right py-3 w-[70px]">Qty</th>
                <th className="text-right py-3 w-[120px]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const amount =
                  l.unit_price != null ? l.qty * l.unit_price : null;
                return (
                  <tr key={l.id} className="border-t border-foreground/[0.04]">
                    <td className="py-3.5 pr-4 align-top">
                      <div className="text-sm font-medium">
                        {l.part_short_description ?? l.part_internal_pn ?? (
                          <span className="text-muted-foreground italic">
                            No description
                          </span>
                        )}
                      </div>
                      {l.part_internal_pn && l.part_short_description && (
                        <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                          {l.part_internal_pn}
                        </div>
                      )}
                      {l.line_notes_customer && (
                        <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
                          {l.line_notes_customer}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 text-right tabular-nums align-top">
                      {formatMoney(l.unit_price)}
                    </td>
                    <td className="py-3.5 text-right tabular-nums align-top">
                      {l.qty}
                    </td>
                    <td className="py-3.5 text-right tabular-nums font-medium align-top">
                      {amount != null ? formatMoney(amount) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Totals ── */}
      <div className="px-8 pb-8 flex justify-end">
        <div className="w-full max-w-xs space-y-2 text-sm">
          <div className="border-t pt-3" />
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax (0%)</span>
            <span className="tabular-nums">$0.00</span>
          </div>
          <div className="border-t my-1" />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
