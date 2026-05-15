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

// Anthropic API caps PDFs at 32MB per document block. Vendor quotes are
// almost always < 5MB; this is a hard guard against pathological cases.
const MAX_PDF_BYTES = 32 * 1024 * 1024;

export async function extractPdfAttachment(input: {
  filename: string;
  buffer: Buffer;
}): Promise<ExtractionResult> {
  // Cache check — sha256(file_bytes) + PROMPT_VERSION. Identical bytes +
  // identical prompt version → guaranteed identical extraction; skip LLM.
  const contentHash = hashBytes(input.buffer);
  const cached = await readAttachmentCache(contentHash);
  if (cached) return cached;

  if (input.buffer.byteLength === 0) {
    const empty: ExtractionResult = {
      source_type: "other",
      customer_or_vendor_hint: null,
      lines: [],
    };
    await writeAttachmentCache(contentHash, empty);
    return empty;
  }
  if (input.buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `PDF too large for native extraction: ${input.buffer.byteLength} bytes (max ${MAX_PDF_BYTES}). Filename: ${input.filename}`,
    );
  }

  const reference = await getPartNamingReference();
  const referenceText = renderReferenceForPrompt(reference);
  const base64 = input.buffer.toString("base64");

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
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64,
                  },
                  // Cache the PDF too — same vendor often sends quotes with
                  // a shared template. Hash-keyed cache above handles exact
                  // dupes; this handles near-dupes within a 5-min window.
                  cache_control: { type: "ephemeral" },
                },
                {
                  type: "text",
                  text: `Filename: ${input.filename}`,
                },
              ],
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
