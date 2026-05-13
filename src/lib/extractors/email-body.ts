import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  ExtractionResultSchema,
  type ExtractionResult,
} from "./_pattern";

// Static prefix — cached at the Anthropic API layer via cache_control.
// Keep this stable; changes invalidate the cache and incur full-cost reads.
const SYSTEM_PROMPT = `You are an extraction engine for CAP Hardware Supply, a hardware/fastener distributor.

You read inbound emails and return STRUCTURED JSON describing any quote-request or vendor-reply line items.

Rules:
- Output ONLY via the extract_quote_lines tool. Do not write prose.
- For each line item, populate: raw_text (verbatim snippet you read it from), part_number_guess (any PN-shaped token you can find — internal PN, manufacturer PN, vendor PN, or customer alias; null if none), qty (numeric), unit_price (if explicitly stated, else null), confidence (0–1), reasoning (one sentence).
- Set confidence < 0.7 when ANY of: PN is ambiguous, qty is unclear, the line item itself is uncertain.
- Set source_type to:
  - "customer_quote_request" — the sender is asking us to quote pricing for parts
  - "vendor_quote_reply" — the sender is offering us pricing (cost basis)
  - "other" — anything else (chat, shipping question, complaint, marketing)
- customer_or_vendor_hint: a free-text guess at who the sender represents (company name) based on signature / domain.
- If the email is "other", return an empty lines array.

Examples of customer quote-request lines:
- "Need pricing on 500 of part CAP-2210 and 1000 of nylon insert nuts M6."
- "Quote me 250 of 91251A537 please."
- "100 each of: 1/4-20 x 1 SHCS, 5/16-18 x 1 SHCS, 3/8-16 x 1 SHCS"

Examples of vendor-reply lines:
- "CAP-2210: $0.11 ea at 1000, 3 days lead."
- "Pricing attached: P/N 91251A537 — $0.13 ea, 5d. P/N CAP-1002 — $0.04 ea, 1d."

Never invent part numbers that aren't in the source text. If the email says "those screws we had last time" with no PN, set part_number_guess=null and confidence low.`;

const EXTRACTION_TOOL = {
  name: "extract_quote_lines",
  description:
    "Return structured line items extracted from the email body. Always include source_type. lines may be empty for non-quote emails.",
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

const MAX_BODY_CHARS = 24_000; // ~6k tokens — bounds the input size, cuts cost

export async function extractEmailBody(input: {
  subject: string | null;
  body_text: string;
  from_email: string | null;
  from_name: string | null;
}): Promise<ExtractionResult> {
  const client = getAnthropic();

  const truncated = input.body_text.slice(0, MAX_BODY_CHARS);

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
        // Anthropic prompt cache: this stable prefix is reused across every
        // extraction call, paying ~10% of the cost on cache hits (5-min TTL).
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find(
    (c): c is Extract<typeof c, { type: "tool_use" }> => c.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Anthropic response missing tool_use block");
  }

  return ExtractionResultSchema.parse(toolUse.input);
}
