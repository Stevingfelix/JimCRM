import { PDFParse } from "pdf-parse";

async function pdfParse(data: Buffer): Promise<{ text: string }> {
  // pdf-parse v2 API: new PDFParse({ data }).getText()
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  return { text: result.text };
}
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  ExtractionResultSchema,
  type ExtractionResult,
} from "./_pattern";

const SYSTEM_PROMPT = `You are an extraction engine for CAP Hardware Supply, a hardware/fastener distributor. You read PDF documents — usually vendor quotes, customer RFQs, or purchase orders — and return STRUCTURED JSON describing line items.

Rules:
- Output ONLY via the extract_quote_lines tool. Do not write prose.
- PDF text may be misaligned, multi-column, or contain header/footer noise. Use your judgement to ignore boilerplate and identify the line-item table.
- For each line item, populate: raw_text (a verbatim snippet you read it from), part_number_guess (any PN-shaped token — null if none), qty (numeric), unit_price (if explicitly stated, else null), confidence (0–1), reasoning (one sentence).
- Set confidence < 0.7 when ANY of: PN is ambiguous, qty is unclear, the row may be a header/total row.
- Set source_type to:
  - "customer_quote_request" — customer RFQ asking us to quote
  - "vendor_quote_reply" — vendor pricing offered to us
  - "other" — spec sheet, statement, invoice, marketing, etc.
- customer_or_vendor_hint: company name from the PDF header/letterhead if visible.

Never invent part numbers. If a row has obviously partial data (e.g. just a description), set part_number_guess=null and confidence low.`;

const EXTRACTION_TOOL = {
  name: "extract_quote_lines",
  description:
    "Return structured line items extracted from the PDF text. lines may be empty for non-quote documents.",
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

const MAX_PDF_CHARS = 30_000;

export async function extractPdfAttachment(input: {
  filename: string;
  buffer: Buffer;
}): Promise<ExtractionResult> {
  const parsed = await pdfParse(input.buffer);
  const text = parsed.text.slice(0, MAX_PDF_CHARS).trim();

  if (text.length < 20) {
    // Empty / image-only PDF — return an empty extraction.
    return {
      source_type: "other",
      customer_or_vendor_hint: null,
      lines: [],
    };
  }

  const client = getAnthropic();
  const response = await client.messages.create({
    model: MODELS.extraction,
    max_tokens: 4096,
    tools: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      EXTRACTION_TOOL as any,
    ],
    tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Filename: ${input.filename}\n\n${text}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (c): c is Extract<typeof c, { type: "tool_use" }> => c.type === "tool_use",
  );
  if (!toolUse) throw new Error("Anthropic response missing tool_use block");

  return ExtractionResultSchema.parse(toolUse.input);
}
