import * as XLSX from "xlsx";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  ExtractionResultSchema,
  type ExtractionResult,
} from "./_pattern";

const SYSTEM_PROMPT = `You are an extraction engine for CAP Hardware Supply, a hardware/fastener distributor. You read Excel-derived CSV text — usually vendor quotes, customer RFQs, or part lists — and return STRUCTURED JSON describing line items.

Rules:
- Output ONLY via the extract_quote_lines tool. Do not write prose.
- The first non-empty row is typically the header. Column names vary widely between vendors — infer the meaning of each column from its values and any header text.
- Skip header/footer rows that don't represent line items (e.g. "TOTAL", "Subtotal", "Page 1 of 2", blank rows).
- For each line item, populate: raw_text (the joined row cells separated by " | "), part_number_guess (any PN-shaped token; null if none), qty (numeric), unit_price (if present, else null), confidence (0–1), reasoning (one sentence).
- Set confidence < 0.7 when ANY of: PN is ambiguous, multiple columns could be the PN, qty is unclear.
- Set source_type to:
  - "customer_quote_request" — RFQ asking us to quote
  - "vendor_quote_reply" — vendor pricing offered to us
  - "other" — anything else
- customer_or_vendor_hint: any company name you can spot in the sheet (often in a top-left header cell).

If a sheet is essentially empty or only contains formatting examples, return empty lines.`;

const EXTRACTION_TOOL = {
  name: "extract_quote_lines",
  description:
    "Return structured line items extracted from the spreadsheet rows. lines may be empty for non-quote sheets.",
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

const MAX_CSV_CHARS = 30_000;

export async function extractExcelAttachment(input: {
  filename: string;
  buffer: Buffer;
}): Promise<ExtractionResult> {
  const wb = XLSX.read(input.buffer, { type: "buffer" });

  // Concatenate all sheets, prefixing with the sheet name.
  const blocks: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim().length === 0) continue;
    blocks.push(`### Sheet: ${name}\n${csv}`);
  }
  const text = blocks.join("\n\n").slice(0, MAX_CSV_CHARS).trim();

  if (text.length < 20) {
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
