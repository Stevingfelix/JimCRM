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
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-6 sm:px-8 sm:py-7 flex items-start justify-between gap-6">
        <div className="space-y-1">
          <div className="text-base font-semibold">{company.company_name}</div>
          {company.address && (
            <div className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
              {company.address}
            </div>
          )}
          <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
            {company.phone && <div>{company.phone}</div>}
            {company.contact_email && <div>{company.contact_email}</div>}
            {company.tax_id && <div>Tax ID: {company.tax_id}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-light tracking-wider text-muted-foreground">
            QUOTE
          </div>
          <div className="text-sm tabular-nums mt-1">
            {formatQuoteNumber(quote.quote_number)}
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="px-6 sm:px-8 pb-6 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
        <div>
          <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Billed To
          </div>
          <div className="text-sm font-medium mt-1.5">{quote.customer_name}</div>
          {quote.customer_primary_contact?.email && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {quote.customer_primary_contact.email}
            </div>
          )}
          {quote.customer_primary_contact?.phone && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {quote.customer_primary_contact.phone}
            </div>
          )}
          {quote.customer_billing_address && (
            <div className="text-xs text-muted-foreground whitespace-pre-line mt-0.5">
              {quote.customer_billing_address}
            </div>
          )}
        </div>

        <div>
          <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Issue Date
          </div>
          <div className="text-sm mt-1.5 tabular-nums">
            {formatDate(quote.created_at)}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Valid Until
          </div>
          <div className="text-sm mt-1.5 tabular-nums">
            {quote.validity_date ? formatDate(quote.validity_date) : "—"}
          </div>
        </div>

        <div className="sm:text-right">
          <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Total
          </div>
          <div className="text-xl font-semibold mt-1 tabular-nums">
            {formatMoney(subtotal)}
          </div>
        </div>
      </div>

      {/* Lines */}
      {lines.length > 0 && (
        <div className="border-t">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] tracking-wider text-muted-foreground uppercase">
                  <th className="text-left font-medium px-6 sm:px-8 py-3">
                    Description
                  </th>
                  <th className="text-left font-medium py-3 w-[140px]">PN</th>
                  <th className="text-right font-medium py-3 w-[60px]">Qty</th>
                  <th className="text-right font-medium py-3 w-[110px]">
                    Rate
                  </th>
                  <th className="text-right font-medium px-6 sm:px-8 py-3 w-[130px]">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const amount =
                    l.unit_price != null ? l.qty * l.unit_price : null;
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="px-6 sm:px-8 py-3 align-top">
                        <div className="text-sm">
                          {l.part_description ?? (
                            <span className="text-muted-foreground italic">
                              No description
                            </span>
                          )}
                        </div>
                        {l.line_notes_customer && (
                          <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
                            {l.line_notes_customer}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground tabular-nums align-top">
                        {l.part_internal_pn ?? "—"}
                      </td>
                      <td className="py-3 text-right tabular-nums align-top">
                        {l.qty}
                      </td>
                      <td className="py-3 text-right tabular-nums align-top">
                        {formatMoney(l.unit_price)}
                      </td>
                      <td className="px-6 sm:px-8 py-3 text-right tabular-nums font-medium align-top">
                        {amount != null ? formatMoney(amount) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t px-6 sm:px-8 py-4 flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(subtotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
