/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { QuotePdfProps } from "./types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0a0a0a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  logo: { width: 48, height: 48, objectFit: "contain" },
  company: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  companySub: { fontSize: 9, color: "#666" },
  quoteMeta: { fontSize: 10, textAlign: "right" },
  quoteNumber: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  metaLine: { marginTop: 2, color: "#444" },
  accentBar: { height: 3, marginBottom: 18 },
  customerBlock: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  customerLabel: {
    fontSize: 8,
    color: "#666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  customerName: { fontSize: 11, fontWeight: 700 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1pt solid #0a0a0a",
    paddingVertical: 6,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#0a0a0a",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottom: "0.5pt solid #ddd",
    alignItems: "flex-start",
  },
  col_no: { width: "5%" },
  col_pn: { width: "20%" },
  col_desc: { width: "45%", paddingRight: 8 },
  col_qty: { width: "10%", textAlign: "right" },
  col_unit: { width: "10%", textAlign: "right" },
  col_total: { width: "10%", textAlign: "right" },
  totalsBlock: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsTable: { width: 200 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsLabel: { fontSize: 9, color: "#444" },
  totalsValue: { fontSize: 10, fontWeight: 700 },
  notesBlock: { marginTop: 28 },
  notesLabel: {
    fontSize: 8,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  notesBody: { fontSize: 10, lineHeight: 1.4, color: "#222" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#888",
    textAlign: "center",
    borderTop: "0.5pt solid #ddd",
    paddingTop: 8,
  },
  lineNotes: {
    fontSize: 8,
    color: "#666",
    marginTop: 2,
    fontStyle: "italic",
  },
});

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

function isValidHex(s: string | null): s is string {
  return !!s && /^#[0-9a-fA-F]{6}$/.test(s);
}

export function CapBrandedTemplate({ quote }: QuotePdfProps) {
  const subtotal = quote.lines.reduce<number>((acc, l) => {
    if (l.unit_price == null) return acc;
    return acc + l.qty * l.unit_price;
  }, 0);

  const { company } = quote;
  const accentColor = isValidHex(company.brand_color)
    ? company.brand_color
    : "#10b981";

  const footerLine = [
    quote.display_number,
    company.company_name,
    company.pdf_footer_text,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Document title={`Quote ${quote.display_number}`} author={company.company_name}>
      <Page size="LETTER" style={styles.page}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {company.logo_url && (
              <Image style={styles.logo} src={company.logo_url} />
            )}
            <View>
              <Text style={styles.company}>{company.company_name}</Text>
              {company.tagline && (
                <Text style={styles.companySub}>{company.tagline}</Text>
              )}
              {company.contact_email && (
                <Text style={styles.companySub}>{company.contact_email}</Text>
              )}
              {company.phone && (
                <Text style={styles.companySub}>{company.phone}</Text>
              )}
              {company.website && (
                <Text style={styles.companySub}>{company.website}</Text>
              )}
            </View>
          </View>
          <View style={styles.quoteMeta}>
            <Text style={styles.quoteNumber}>{quote.display_number}</Text>
            <Text style={styles.metaLine}>
              Issued: {formatDate(quote.created_at)}
            </Text>
            {quote.validity_date && (
              <Text style={styles.metaLine}>
                Valid through: {formatDate(quote.validity_date)}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        {/* CUSTOMER */}
        <View style={styles.customerBlock}>
          <Text style={styles.customerLabel}>Quote for</Text>
          <Text style={styles.customerName}>{quote.customer_name}</Text>
        </View>

        {/* LINES */}
        <View style={styles.tableHeader}>
          <Text style={styles.col_no}>#</Text>
          <Text style={styles.col_pn}>Part</Text>
          <Text style={styles.col_desc}>Description</Text>
          <Text style={styles.col_qty}>Qty</Text>
          <Text style={styles.col_unit}>Unit</Text>
          <Text style={styles.col_total}>Total</Text>
        </View>
        {quote.lines.map((line, idx) => {
          const lineTotal =
            line.unit_price != null ? line.qty * line.unit_price : null;
          return (
            <View key={idx} style={styles.tableRow} wrap={false}>
              <Text style={styles.col_no}>{idx + 1}</Text>
              <Text style={styles.col_pn}>{line.part_internal_pn ?? "—"}</Text>
              <View style={styles.col_desc}>
                <Text>{line.part_description ?? ""}</Text>
                {line.line_notes_customer && (
                  <Text style={styles.lineNotes}>{line.line_notes_customer}</Text>
                )}
              </View>
              <Text style={styles.col_qty}>{line.qty}</Text>
              <Text style={styles.col_unit}>
                {line.unit_price != null ? formatMoney(line.unit_price) : "—"}
              </Text>
              <Text style={styles.col_total}>
                {lineTotal != null ? formatMoney(lineTotal) : "—"}
              </Text>
            </View>
          );
        })}

        {/* TOTALS */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatMoney(subtotal)}</Text>
            </View>
          </View>
        </View>

        {/* CUSTOMER NOTES */}
        {quote.customer_notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesBody}>{quote.customer_notes}</Text>
          </View>
        )}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${footerLine}  ·  Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
