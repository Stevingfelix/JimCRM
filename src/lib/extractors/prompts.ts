// Shared extraction prompts. Bumping PROMPT_VERSION invalidates every
// attachment cache entry (see attachment-cache.ts) — bump whenever the
// system text or extraction tool schema is changed in a way that should
// produce different output.
export const PROMPT_VERSION = "v1-2026-05-14";

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
          },
          required: [
            "raw_text",
            "part_number_guess",
            "qty",
            "unit_price",
            "confidence",
            "reasoning",
          ],
        },
      },
    },
    required: ["source_type", "customer_or_vendor_hint", "lines"],
  },
} as const;
