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

function sanitizeLine(line: {
  raw_text: string;
  part_number_guess: string | null;
  qty: number | null;
  unit_price: number | null;
  confidence: number;
  reasoning: string;
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

  // Floor confidence to ensure flagged lines route to review queue (<0.7).
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
  };
}

export const ExtractedLineSchema = z
  .object({
    raw_text: z.string(),
    part_number_guess: z.string().nullable(),
    qty: z.number().nullable(),
    unit_price: z.number().nullable(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
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
