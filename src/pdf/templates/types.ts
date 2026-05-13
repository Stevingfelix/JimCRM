export type QuotePdfLine = {
  qty: number;
  unit_price: number | null;
  part_internal_pn: string | null;
  part_description: string | null;
  line_notes_customer: string | null;
};

export type QuotePdfData = {
  display_number: string;
  customer_name: string;
  created_at: string;
  validity_date: string | null;
  customer_notes: string | null;
  lines: QuotePdfLine[];
};

export type QuotePdfProps = { quote: QuotePdfData };
