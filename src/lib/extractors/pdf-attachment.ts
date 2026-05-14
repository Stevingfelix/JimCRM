import { PDFParse } from "pdf-parse";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { retry } from "@/lib/retry";
import { trackLlmCall } from "@/lib/llm-telemetry";
import {
  getPartNamingReference,
  renderReferenceForPrompt,
} from "@/lib/part-naming";
import {
  ExtractionResultSchema,
  type ExtractionResult,
} from "./_pattern";
import {
  CAP_PN_RULES,
  EXTRACTION_TOOL,
  PDF_ADDENDUM,
  SHARED_EXTRACTION_BASE,
} from "./prompts";
import {
  hashBytes,
  readAttachmentCache,
  writeAttachmentCache,
} from "./attachment-cache";

async function pdfParse(data: Buffer): Promise<{ text: string }> {
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  return { text: result.text };
}

const MAX_PDF_CHARS = 30_000;

export async function extractPdfAttachment(input: {
  filename: string;
  buffer: Buffer;
}): Promise<ExtractionResult> {
  // Cache check — sha256(file_bytes) + PROMPT_VERSION. Identical bytes +
  // identical prompt version → guaranteed identical extraction; skip LLM.
  const contentHash = hashBytes(input.buffer);
  const cached = await readAttachmentCache(contentHash);
  if (cached) return cached;

  const parsed = await pdfParse(input.buffer);
  const text = parsed.text.slice(0, MAX_PDF_CHARS).trim();

  if (text.length < 20) {
    const empty: ExtractionResult = {
      source_type: "other",
      customer_or_vendor_hint: null,
      lines: [],
    };
    await writeAttachmentCache(contentHash, empty);
    return empty;
  }

  const reference = await getPartNamingReference();
  const referenceText = renderReferenceForPrompt(reference);

  const client = getAnthropic();
  const response = await trackLlmCall(
    "pdf_attachment",
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
              text: `${SHARED_EXTRACTION_BASE}\n\n${CAP_PN_RULES}\n\n${PDF_ADDENDUM}`,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: referenceText,
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
