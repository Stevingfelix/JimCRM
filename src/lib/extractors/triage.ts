import { z } from "zod";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { trackLlmCall } from "@/lib/llm-telemetry";
import { retry } from "@/lib/retry";

// Cheap Haiku gate that runs before the Sonnet extractors. Decides whether
// an email is worth extracting at all. Saves Sonnet tokens on newsletters,
// transactional notices, and other non-quote noise that slipped past Gmail
// filtering.

export const TRIAGE_PROMPT_VERSION = "v1-2026-05-15";

const TriageVerdictSchema = z.object({
  verdict: z.enum(["extract", "skip"]),
  category: z.enum([
    "customer_rfq",
    "vendor_quote",
    "general_business",
    "marketing",
    "transactional",
    "support",
    "other",
  ]),
  reason: z.string(),
});

export type TriageVerdict = z.infer<typeof TriageVerdictSchema>;

const TRIAGE_TOOL = {
  name: "triage_email",
  description:
    "Decide whether this inbound email needs full quote extraction or can be skipped.",
  input_schema: {
    type: "object",
    properties: {
      verdict: {
        type: "string",
        enum: ["extract", "skip"],
        description:
          'Set "extract" ONLY for customer RFQs or vendor quote replies that contain (or attach) concrete line items. Anything else is "skip".',
      },
      category: {
        type: "string",
        enum: [
          "customer_rfq",
          "vendor_quote",
          "general_business",
          "marketing",
          "transactional",
          "support",
          "other",
        ],
      },
      reason: {
        type: "string",
        description: "One-sentence rationale for the verdict.",
      },
    },
    required: ["verdict", "category", "reason"],
  },
} as const;

const SYSTEM_PROMPT = `You are a binary email triage gate for CAP Hardware Supply, a fastener/hardware distributor.

Decide whether an email needs full quote extraction (expensive) or can be skipped (free).

CAP's watched inbox receives:
- CUSTOMER RFQs — someone asking us to quote a part number with a quantity. Common patterns: subject contains "RFQ" / "quote" / "pricing" / "P/N" / "parts needed", body has explicit PN + qty ("Please quote 10K pcs of NAS662C2-R2", "Need pricing on 500 of CAP-2210"). IMPORTANT: if the body contains anything that looks like a mil-spec or industry part number (e.g. MS, NAS, AN, BAC, NAS, CAP- prefixes followed by numbers/dashes), this is ALWAYS an RFQ — extract it even without explicit quantity or "quote" language. Part numbers alone in the body = customer RFQ.
- VENDOR QUOTES — a vendor replying with line-item pricing. Patterns: PN + qty + price ("MS171494  320 pcs @ \\$.16 each"), or a PDF/Excel attachment that looks like a vendor quote document.
- GENERAL BUSINESS — CAP-related but not a quote (delivery confirmations, invoices, PO acknowledgments, shipping updates, customer support replies, internal team mail).
- MARKETING / NEWSLETTERS — product announcements, weekly digests, promotional mail ("FINAL DAYS: 50% OFF", "Subscribe to unlock", "Your weekly update").
- TRANSACTIONAL — automated notifications (bank statements, password resets, calendar invites, "your account has been updated").
- SUPPORT / OOO — automated replies, out-of-office, ticket confirmations.

Return verdict="extract" when:
- The email is a CUSTOMER RFQ or a VENDOR QUOTE with concrete line items (in body or attachment).
- The email has PDF or Excel attachments. These are almost always quote documents at CAP — always extract when attachments are present, even if the body text is minimal ("see attached", "please quote per attached", etc.).

Return verdict="skip" for everything else, including:
- Quoted-thread-only emails (just signature + boilerplate replies) WITH NO attachments
- General business mail without any PN/qty/price content AND no attachments
- Marketing, newsletters, transactional, support, OOO
- Senders like "no-reply", "noreply", "billing", "support", "notifications" (UNLESS the subject + body clearly indicate a vendor quote OR the email has PDF/Excel attachments)

When in doubt between extract vs skip, prefer "extract" — the downstream extractor will return lines:[] for non-quotes anyway. But for unambiguous noise, skip decisively.`;

export type TriageInput = {
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  body_preview: string;
  attachment_meta: Array<{
    filename: string;
    mime_type: string | null;
    kind: "pdf" | "excel" | "image" | null;
  }>;
};

export async function triageEmail(input: TriageInput): Promise<TriageVerdict> {
  const client = getAnthropic();

  const attachmentsBlock =
    input.attachment_meta.length > 0
      ? input.attachment_meta
          .map(
            (a) =>
              `- ${a.filename} (${a.mime_type ?? "unknown"}${a.kind ? `, kind=${a.kind}` : ""})`,
          )
          .join("\n")
      : "(none)";

  const userContent = [
    `Subject: ${input.subject ?? "(none)"}`,
    `From: ${input.from_name ? `${input.from_name} ` : ""}<${input.from_email ?? "unknown"}>`,
    "",
    "Body preview (first 800 chars):",
    input.body_preview.slice(0, 800) || "(empty)",
    "",
    "Attachments:",
    attachmentsBlock,
  ].join("\n");

  const response = await trackLlmCall("triage", MODELS.classification, () =>
    retry(() =>
      client.messages.create({
        model: MODELS.classification,
        max_tokens: 256,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [TRIAGE_TOOL as any],
        tool_choice: { type: "tool", name: TRIAGE_TOOL.name },
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
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
    // Fail open — if the triage call breaks, fall back to full extraction.
    return {
      verdict: "extract",
      category: "other",
      reason: "triage tool_use missing — falling back to extract",
    };
  }

  return TriageVerdictSchema.parse(toolUse.input);
}
