import * as XLSX from "xlsx";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { retry } from "@/lib/retry";
import { trackLlmCall } from "@/lib/llm-telemetry";
import {
  ExtractionResultSchema,
  type ExtractionResult,
} from "./_pattern";
import {
  EXCEL_ADDENDUM,
  EXTRACTION_TOOL,
  SHARED_EXTRACTION_BASE,
} from "./prompts";
import {
  hashBytes,
  readAttachmentCache,
  writeAttachmentCache,
} from "./attachment-cache";

const MAX_CSV_CHARS = 30_000;

export async function extractExcelAttachment(input: {
  filename: string;
  buffer: Buffer;
}): Promise<ExtractionResult> {
  const contentHash = hashBytes(input.buffer);
  const cached = await readAttachmentCache(contentHash);
  if (cached) return cached;

  const wb = XLSX.read(input.buffer, { type: "buffer" });

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
    const empty: ExtractionResult = {
      source_type: "other",
      customer_or_vendor_hint: null,
      lines: [],
    };
    await writeAttachmentCache(contentHash, empty);
    return empty;
  }

  const client = getAnthropic();
  const response = await trackLlmCall(
    "excel_attachment",
    MODELS.extraction,
    () =>
      retry(() =>
        client.messages.create({
          model: MODELS.extraction,
          max_tokens: 4096,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: [EXTRACTION_TOOL as any],
          tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
          system: [
            {
              type: "text",
              text: SHARED_EXTRACTION_BASE,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: EXCEL_ADDENDUM,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            {
              role: "user",
              content: `Filename: ${input.filename}\n\n${text}`,
            },
          ],
        }),
      ),
  );

  const toolUse = response.content.find(
    (c): c is Extract<typeof c, { type: "tool_use" }> => c.type === "tool_use",
  );
  if (!toolUse) throw new Error("Anthropic response missing tool_use block");

  const extraction = ExtractionResultSchema.parse(toolUse.input);
  await writeAttachmentCache(contentHash, extraction);
  return extraction;
}
