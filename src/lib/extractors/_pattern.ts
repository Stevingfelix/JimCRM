import { z } from "zod";

// Sanitisation guards — applied automatically to every extracted line by all
// three extractors (email body, PDF, Excel) via the Zod .transform() below.
//
// Philosophy: don't reject the line outright if the LLM returns weird data —
// that loses the row entirely. Instead, NULL out obviously-bad fields, append
// a warning into reasoning, and cap confidence so the line routes through the
// review queue for Jim to fix.

const MAX_REASONABLE_QTY = 1_000_000;
const MAX_REASONABLE_PRICE = 1_000_000;
const PN_LOOKS_LIKE_DATE = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/;
const PN_LOOKS_LIKE_PHONE = /^\+?\d{3}[\.\-\s]?\d{3}[\.\-\s]?\d{4}$/;

type CapPnComponents = {
  family: string | null;
  size_code: string | null;
  thread: string | null;
  length_code: string | null;
  attribute_code: string | null;
  missing_fields: string[];
  suggested_pn: string | null;
} | null;

function sanitizeLine(line: {
  raw_text: string;
  part_number_guess: string | null;
  qty: number | null;
  unit_price: number | null;
  confidence: number;
  reasoning: string;
  cap_pn_components?: CapPnComponents;
}) {
  const warnings: string[] = [];

  let qty = line.qty;
  if (qty != null) {
    if (!Number.isFinite(qty)) {
      qty = null;
      warnings.push("non-finite qty");
    } else if (qty < 0) {
      qty = null;
      warnings.push("negative qty");
    } else if (qty > MAX_REASONABLE_QTY) {
      qty = null;
      warnings.push(`absurd qty (>${MAX_REASONABLE_QTY.toLocaleString()})`);
    }
  }

  let unit_price = line.unit_price;
  if (unit_price != null) {
    if (!Number.isFinite(unit_price)) {
      unit_price = null;
      warnings.push("non-finite unit_price");
    } else if (unit_price < 0) {
      unit_price = null;
      warnings.push("negative unit_price");
    } else if (unit_price > MAX_REASONABLE_PRICE) {
      unit_price = null;
      warnings.push(`absurd unit_price (>${MAX_REASONABLE_PRICE.toLocaleString()})`);
    }
  }

  let part_number_guess = line.part_number_guess?.trim() || null;
  if (part_number_guess) {
    if (PN_LOOKS_LIKE_DATE.test(part_number_guess)) {
      part_number_guess = null;
      warnings.push("part number looks like a date");
    } else if (PN_LOOKS_LIKE_PHONE.test(part_number_guess)) {
      part_number_guess = null;
      warnings.push("part number looks like a phone");
    } else if (part_number_guess.length > 120) {
      part_number_guess = part_number_guess.slice(0, 120);
      warnings.push("part number truncated to 120 chars");
    }
  }

  // Sanity-check the composed CAP PN. If the model returned a suggested_pn
  // but also declared missing_fields, the suggestion is suspect — surface
  // that and clear it. Don't fight the model otherwise; it has the rules.
  let components = line.cap_pn_components ?? null;
  if (components) {
    if (
      components.suggested_pn &&
      components.missing_fields &&
      components.missing_fields.length > 0
    ) {
      warnings.push("cap_pn suggestion conflicts with missing_fields");
      components = { ...components, suggested_pn: null };
    }
  }

  // Floor confidence to route flagged lines through the review queue (<0.7).
  const confidence =
    warnings.length > 0 ? Math.min(line.confidence, 0.5) : line.confidence;

  return {
    raw_text: line.raw_text,
    part_number_guess,
    qty,
    unit_price,
    confidence,
    reasoning:
      warnings.length > 0
        ? `${line.reasoning} [⚠ ${warnings.join(", ")}]`
        : line.reasoning,
    cap_pn_components: components,
  };
}

const CapPnComponentsSchema = z
  .object({
    family: z.string().nullable(),
    size_code: z.string().nullable(),
    thread: z.string().nullable(),
    length_code: z.string().nullable(),
    attribute_code: z.string().nullable(),
    missing_fields: z.array(z.string()).default([]),
    suggested_pn: z.string().nullable(),
  })
  .nullable()
  .optional();

export const ExtractedLineSchema = z
  .object({
    raw_text: z.string(),
    part_number_guess: z.string().nullable(),
    qty: z.number().nullable(),
    unit_price: z.number().nullable(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    cap_pn_components: CapPnComponentsSchema,
  })
  .transform(sanitizeLine);

export const ExtractionResultSchema = z.object({
  source_type: z.enum(["customer_quote_request", "vendor_quote_reply", "other"]),
  customer_or_vendor_hint: z.string().nullable(),
  lines: z.array(ExtractedLineSchema),
});

export type ExtractedLine = z.infer<typeof ExtractedLineSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export const REVIEW_CONFIDENCE_THRESHOLD = 0.7;
