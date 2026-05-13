import { z } from "zod";

// Canonical extraction output. All three extractors (email body, PDF, Excel)
// resolve to this shape before alias lookup + review-queue routing.
export const ExtractedLineSchema = z.object({
  raw_text: z.string(),
  part_number_guess: z.string().nullable(),
  qty: z.number().nullable(),
  unit_price: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const ExtractionResultSchema = z.object({
  source_type: z.enum(["customer_quote_request", "vendor_quote_reply", "other"]),
  customer_or_vendor_hint: z.string().nullable(),
  lines: z.array(ExtractedLineSchema),
});

export type ExtractedLine = z.infer<typeof ExtractedLineSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export const REVIEW_CONFIDENCE_THRESHOLD = 0.7;
