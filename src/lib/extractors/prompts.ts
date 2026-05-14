// Shared extraction prompts. Bumping PROMPT_VERSION invalidates every
// attachment cache entry (see attachment-cache.ts) — bump whenever the
// system text or extraction tool schema is changed in a way that should
// produce different output.
export const PROMPT_VERSION = "v3-2026-05-14-milspec";

// Common rules for all three extractors (email body, PDF, Excel). This
// block is marked cache_control so it amortizes across every extractor
// type within the 5-min cache window.
export const SHARED_EXTRACTION_BASE = `You are an extraction engine for CAP Hardware Supply, a hardware/fastener distributor.

You read inbound text and return STRUCTURED JSON describing any quote-request or vendor-reply line items.

Universal rules:
- Output ONLY via the extract_quote_lines tool. Never write prose.
- For each line item, populate: raw_text (verbatim source snippet), part_number_guess (any PN-shaped token; null if none), qty (numeric), unit_price (if explicit, else null), confidence (0–1), reasoning (one sentence).
- confidence < 0.7 when ANY of: PN ambiguous, qty unclear, line itself uncertain.
- source_type: "customer_quote_request" (asking us to quote), "vendor_quote_reply" (offering us pricing), or "other" (non-quote, return lines: []).
- customer_or_vendor_hint: free-text company name from sender/header if visible.
- NEVER invent part numbers absent from the source. If a reference is vague ("those screws we had last time"), set part_number_guess=null and confidence low.`;

// CAP part-number composition rules. Pairs with the rendered reference
// data (families/sizes/threads/attributes) injected at call time.
//
// CRITICAL nuance learned from real RFQ samples: most customer requests
// reference an external standard PN (mil-spec, NAS, AN, M-prefix, vendor
// catalog number, raw numeric SKU). These are NOT descriptions to compose
// from — they're identifiers that need alias mapping downstream. The
// extractor should record them in part_number_guess and SKIP cap_pn
// composition for those lines.
export const CAP_PN_RULES = `CAP-PN COMPOSITION RULES

You may attempt to compose a CAP-format part number ONLY when the source line is described in plain English (e.g. "1/4-20 grade 8 yellow zinc hex bolt, 3/4 long"). In that case populate cap_pn_components with what you can extract from the text. Rules:
- Use ONLY codes that appear in the reference table below. If the size/thread/attribute isn't listed, set that field to null and add the missing piece name ("size", "thread", "length", "attribute", etc.) to missing_fields.
- length_code is a 4-digit thousandths-of-inch string with leading zeros: 1/2" = "0500", 3/4" = "0750", 1" = "1000", 1.5" = "1500", 2" = "2000".
- suggested_pn: compose ONLY if family + every field the family requires is present. Format: "PREFIX SIZE+THREAD-LENGTH+ATTRIBUTE" (no extra spaces). Example: HCS 04C-0750G8Y. If anything required is missing, set suggested_pn=null.

DO NOT compose cap_pn_components when the line references an external PN. Set cap_pn_components=null in any of these cases:
- The line contains a mil-spec / NAS / AN / MS / NASM identifier (e.g. "MS21209-F1-20", "NAS1130-08-15", "NASM5677-50", "AN960-10", "MS51959-32").
- The line contains an M-prefix / dash-spec identifier with slashes (e.g. "M83248/2-119", "MIL-DTL-83248/1-044").
- The line contains a manufacturer / vendor catalog number (e.g. "94350A145" McMaster, "91251A537", "CLSS-024-3", "BS-032-2").
- The line is a raw numeric SKU with no descriptive text ("78171", "78188").
- The line is a vendor_quote_reply (vendor PNs are external by definition).
- The line is a "special" / aerospace / non-commercial item that doesn't fit CAP's schema.

For all of those cases: leave cap_pn_components=null, put the recognized PN string in part_number_guess so downstream alias lookup can find a CAP part for it, and use reasoning to note "external customer PN — alias lookup required" or similar.

Never invent codes that aren't listed. Never guess a length/thread/grade not stated in the source.`;

export const EMAIL_ADDENDUM = `Input type: email body (prose, possibly with quote thread / signature).

Examples of customer quote-request lines:
- "Need pricing on 500 of CAP-2210 and 1000 of nylon insert nuts M6."
- "Quote me 250 of 91251A537 please."
- "100 each of: 1/4-20 x 1 SHCS, 5/16-18 x 1 SHCS, 3/8-16 x 1 SHCS"

Examples of vendor-reply lines:
- "CAP-2210: $0.11 ea at 1000, 3 days lead."
- "Pricing attached: P/N 91251A537 — $0.13 ea, 5d."

Ignore quoted reply threads, signatures, disclaimers, and unsubscribe footers unless they contain the only line items.`;

export const PDF_ADDENDUM = `Input type: PDF-extracted text. Usually a vendor quote, customer RFQ, or purchase order.

PDF text may be misaligned, multi-column, or contain header/footer noise. Identify the line-item table by looking for a row containing PN/qty/price/desc-style headers, then read each data row beneath it.

Skip rows that are obviously not line items (totals, subtotals, "Page 1 of N", boilerplate). If a row clearly belongs to a different table or section, ignore it.`;

export const EXCEL_ADDENDUM = `Input type: Excel-derived CSV text. Multiple sheets may be concatenated and prefixed with "### Sheet: <name>".

The first non-empty row in each sheet is typically the header. Column names vary between vendors — infer the meaning of each column from its values and the header text.

Skip rows that obviously aren't line items: TOTAL, Subtotal, blank rows, page-footer artifacts. If multiple sheets contain line items, return them all.`;

// Shared tool schema. Lives here so all three extractors call out the
// exact same shape — keeps the schema in sync with _pattern.ts.
export const EXTRACTION_TOOL = {
  name: "extract_quote_lines",
  description:
    "Return structured line items extracted from the source. lines may be empty for non-quote inputs.",
  input_schema: {
    type: "object",
    properties: {
      source_type: {
        type: "string",
        enum: ["customer_quote_request", "vendor_quote_reply", "other"],
      },
      customer_or_vendor_hint: { type: ["string", "null"] },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            raw_text: { type: "string" },
            part_number_guess: { type: ["string", "null"] },
            qty: { type: ["number", "null"] },
            unit_price: { type: ["number", "null"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reasoning: { type: "string" },
            // CAP part-number breakdown. Null when the line doesn't fit
            // CAP's commercial schema (specials, aerospace, ambiguous).
            cap_pn_components: {
              type: ["object", "null"],
              properties: {
                family: { type: ["string", "null"] },
                size_code: { type: ["string", "null"] },
                thread: { type: ["string", "null"] },
                length_code: { type: ["string", "null"] },
                attribute_code: { type: ["string", "null"] },
                missing_fields: { type: "array", items: { type: "string" } },
                suggested_pn: { type: ["string", "null"] },
              },
              required: [
                "family",
                "size_code",
                "thread",
                "length_code",
                "attribute_code",
                "missing_fields",
                "suggested_pn",
              ],
            },
          },
          required: [
            "raw_text",
            "part_number_guess",
            "qty",
            "unit_price",
            "confidence",
            "reasoning",
            "cap_pn_components",
          ],
        },
      },
    },
    required: ["source_type", "customer_or_vendor_hint", "lines"],
  },
} as const;
