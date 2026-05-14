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
  EMAIL_ADDENDUM,
  EXTRACTION_TOOL,
  SHARED_EXTRACTION_BASE,
} from "./prompts";

const MAX_BODY_CHARS = 24_000; // ~6k tokens — bounds the input size, cuts cost

export async function extractEmailBody(input: {
  subject: string | null;
  body_text: string;
  from_email: string | null;
  from_name: string | null;
}): Promise<ExtractionResult> {
  const client = getAnthropic();

  const truncated = input.body_text.slice(0, MAX_BODY_CHARS);

  // Pull the CAP reference rules at call time. The unstable_cache wrapper
  // dedupes the DB read across concurrent extractor calls.
  const reference = await getPartNamingReference();
  const referenceText = renderReferenceForPrompt(reference);

  const userContent = [
    input.subject ? `Subject: ${input.subject}` : null,
    input.from_email
      ? `From: ${input.from_name ? `${input.from_name} ` : ""}<${input.from_email}>`
      : null,
    "",
    truncated,
  ]
    .filter((x): x is string => x !== null)
    .join("\n");

  const response = await trackLlmCall("email_body", MODELS.extraction, () =>
    retry(() =>
      client.messages.create({
        model: MODELS.extraction,
        max_tokens: 4096,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [EXTRACTION_TOOL as any],
        tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
        // Three cache breakpoints: shared base + CAP rules + email
        // addendum are stable across every call. The reference data block
        // sits last so edits to /settings/part-rules only invalidate that
        // suffix, not the whole prefix.
        system: [
          {
            type: "text",
            text: `${SHARED_EXTRACTION_BASE}\n\n${CAP_PN_RULES}\n\n${EMAIL_ADDENDUM}`,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: referenceText,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userContent }],
      }),
    ),
  );

  const toolUse = response.content.find(
    (c): c is Extract<typeof c, { type: "tool_use" }> => c.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Anthropic response missing tool_use block");
  }

  return ExtractionResultSchema.parse(toolUse.input);
}
