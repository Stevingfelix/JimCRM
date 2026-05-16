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
  IMAGE_ADDENDUM,
  SHARED_EXTRACTION_BASE,
} from "./prompts";
import {
  hashBytes,
  readAttachmentCache,
  writeAttachmentCache,
} from "./attachment-cache";

// Anthropic image content blocks support up to 20MB.
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

function inferMediaType(filename: string, fallback: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_MAP[ext] ?? fallback;
}

export async function extractImageAttachment(input: {
  filename: string;
  buffer: Buffer;
  mime_type?: string;
}): Promise<ExtractionResult> {
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
  if (input.buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image too large: ${input.buffer.byteLength} bytes (max ${MAX_IMAGE_BYTES}). Filename: ${input.filename}`,
    );
  }

  const reference = await getPartNamingReference();
  const referenceText = renderReferenceForPrompt(reference);
  const base64 = input.buffer.toString("base64");
  const mediaType = inferMediaType(
    input.filename,
    input.mime_type ?? "image/jpeg",
  );

  const client = getAnthropic();
  const response = await trackLlmCall(
    "image_attachment",
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
              text: `${SHARED_EXTRACTION_BASE}\n\n${CAP_PN_RULES}\n\n${IMAGE_ADDENDUM}`,
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
                  type: "image",
                  source: {
                    type: "base64",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    media_type: mediaType as any,
                    data: base64,
                  },
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
  if (!toolUse) {
    const empty: ExtractionResult = {
      source_type: "other",
      customer_or_vendor_hint: null,
      lines: [],
    };
    await writeAttachmentCache(contentHash, empty);
    return empty;
  }

  const result = ExtractionResultSchema.parse(toolUse.input);
  await writeAttachmentCache(contentHash, result);
  return result;
}
