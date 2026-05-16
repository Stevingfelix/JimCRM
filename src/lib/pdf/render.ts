import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatQuoteNumber } from "@/lib/format";
import { getCompanyInfo } from "@/lib/company";
import { getTemplate } from "@/pdf/templates/registry";
import type { QuotePdfData } from "@/pdf/templates/types";

export async function renderQuotePdf(quoteId: string): Promise<{
  buffer: Buffer;
  filename: string;
  templateKey: string;
}> {
  const supabase = createAdminClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, validity_date, customer_notes, created_at, customer_id, template_id, customers!inner(name), quote_lines(qty, unit_price, line_notes_customer, position, parts(internal_pn, short_description))",
    )
    .eq("id", quoteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!quote) throw new Error("Quote not found");

  type QuoteRow = {
    id: string;
    quote_number: number;
    validity_date: string | null;
    customer_notes: string | null;
    created_at: string;
    customer_id: string;
    template_id: string | null;
    customers: { name: string };
    quote_lines: Array<{
      qty: number;
      unit_price: number | null;
      line_notes_customer: string | null;
      position: number;
      parts: { internal_pn: string; short_description: string | null } | null;
    }>;
  };
  const q = quote as unknown as QuoteRow;

  // Look up template_key for the registry.
  let templateKey = "cap-branded";
  if (q.template_id) {
    const { data: tpl } = await supabase
      .from("pdf_templates")
      .select("react_component_key")
      .eq("id", q.template_id)
      .maybeSingle();
    if (tpl?.react_component_key) templateKey = tpl.react_component_key;
  }

  const company = await getCompanyInfo();

  const data: QuotePdfData = {
    display_number: formatQuoteNumber(q.quote_number),
    customer_name: q.customers.name,
    created_at: q.created_at,
    validity_date: q.validity_date,
    customer_notes: q.customer_notes,
    lines: [...q.quote_lines]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        qty: l.qty,
        unit_price: l.unit_price,
        line_notes_customer: l.line_notes_customer,
        part_internal_pn: l.parts?.internal_pn ?? null,
        part_short_description: l.parts?.short_description ?? null,
      })),
    company: {
      company_name: company.company_name,
      tagline: company.tagline,
      contact_email: company.contact_email,
      phone: company.phone,
      website: company.website,
      address: company.address,
      tax_id: company.tax_id,
      logo_url: company.logo_url,
      pdf_footer_text: company.pdf_footer_text,
      brand_color: company.brand_color,
    },
  };

  const Template = getTemplate(templateKey);
  const element = createElement(Template, { quote: data });
  // renderToBuffer expects ReactElement<DocumentProps>; our wrapper returns a
  // <Document>. Cast through the React element shape since the wrapper is
  // statically known to produce a Document root.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  return {
    buffer,
    filename: `${data.display_number}_${q.customers.name.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`,
    templateKey,
  };
}
