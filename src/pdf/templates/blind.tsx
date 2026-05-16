import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { QuotePdfProps } from "./types";

// Blind / white-label template — no CAP Hardware branding.
// Used when reselling, when the customer doesn't know the upstream supplier,
// or when CAP wants to quote under a different name.
//
// Visually neutral: no logo, no company name in the header, minimal footer.
// All identifying language is generic ("Quote", "Supplier", etc.) so this
// PDF could be sent under any company letterhead via a wrapper email or
// printed on letterhead paper.

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
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
    paddingBottom: 12,
    borderBottom: "1pt solid #0a0a0a",
  },
  quoteLabel: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  quoteMeta: { fontSize: 10, textAlign: "right" },
  quoteNumber: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  metaLine: { marginTop: 2, color: "#444" },
  customerBlock: {
    marginBottom: 24,
  },
  customerLabel: {
    fontSize: 8,
    color: "#666",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  customerName: { fontSize: 11, fontWeight: 700 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1pt solid #0a0a0a",
    paddingVertical: 6,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsTable: { width: 200 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTop: "1pt solid #0a0a0a",
  },
  totalsLabel: { fontSize: 11, fontWeight: 700, textTransform: "uppercase" },
  totalsValue: { fontSize: 12, fontWeight: 700 },
  notesBlock: { marginTop: 32 },
  notesLabel: {
    fontSize: 8,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 1,
  },
  notesBody: { fontSize: 10, lineHeight: 1.4, color: "#222" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 7,
    color: "#aaa",
    textAlign: "center",
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

export function BlindTemplate({ quote }: QuotePdfProps) {
  const subtotal = quote.lines.reduce<number>((acc, l) => {
    if (l.unit_price == null) return acc;
    return acc + l.qty * l.unit_price;
  }, 0);

  return (
    <Document title={`Quote ${quote.display_number}`}>
      <Page size="LETTER" style={styles.page}>
        {/* HEADER — minimal, no company branding */}
        <View style={styles.headerRow}>
          <Text style={styles.quoteLabel}>Quote</Text>
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

        {/* CUSTOMER — no "from" block on purpose (blind) */}
        <View style={styles.customerBlock}>
          <Text style={styles.customerLabel}>Prepared for</Text>
          <Text style={styles.customerName}>{quote.customer_name}</Text>
        </View>

        {/* LINES */}
        <View style={styles.tableHeader}>
          <Text style={styles.col_no}>#</Text>
          <Text style={styles.col_pn}>Item</Text>
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
                <Text>{line.part_short_description ?? ""}</Text>
                {line.line_notes_customer && (
                  <Text style={styles.lineNotes}>
                    {line.line_notes_customer}
                  </Text>
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

        {/* TOTALS — emphasized since there's no company brand to anchor the eye */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total</Text>
              <Text style={styles.totalsValue}>{formatMoney(subtotal)}</Text>
            </View>
          </View>
        </View>

        {/* NOTES */}
        {quote.customer_notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesBody}>{quote.customer_notes}</Text>
          </View>
        )}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => {
            const parts = [quote.display_number];
            if (quote.company.pdf_footer_text)
              parts.push(quote.company.pdf_footer_text);
            parts.push(`Page ${pageNumber} of ${totalPages}`);
            return parts.join("  ·  ");
          }}
        />
      </Page>
    </Document>
  );
}
