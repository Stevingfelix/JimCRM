export type QuotePdfLine = {
  qty: number;
  unit_price: number | null;
  part_internal_pn: string | null;
  part_description: string | null;
  line_notes_customer: string | null;
};

export type QuotePdfCompany = {
  company_name: string;
  tagline: string | null;
  contact_email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  tax_id: string | null;
  logo_url: string | null;
  pdf_footer_text: string | null;
  brand_color: string | null;
};

export type QuotePdfData = {
  display_number: string;
  customer_name: string;
  created_at: string;
  validity_date: string | null;
  customer_notes: string | null;
  lines: QuotePdfLine[];
  company: QuotePdfCompany;
};

export type QuotePdfProps = { quote: QuotePdfData };
