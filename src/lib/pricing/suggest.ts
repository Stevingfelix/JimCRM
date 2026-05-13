import { z } from "zod";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

const SYSTEM_PROMPT = `You are a pricing assistant for CAP Hardware Supply, a hardware/fastener distributor. You suggest a customer-facing unit price for a single quote line, given:
- The internal part description
- The customer asking for the quote
- The 5 most recent customer quotes for the same part (cross-customer)
- The latest vendor cost for the same part (your cost basis)
- The qty tier of this request

Pricing principles:
- Aim for a markup over the latest vendor cost that's consistent with recent quotes.
- Larger qty tiers get a lower markup (volume discount).
- If recent quotes vary widely, weight more recent prices higher.
- If you have NO vendor cost AND NO history, set confidence < 0.5 and return your best guess based on the description alone.
- If you have only vendor cost (no history), apply a default ~25% markup and explain.
- If you have only history (no vendor cost), follow the most recent comparable quote and explain.
- Round prices to 4 decimal places.

Output via the suggest_price tool. Reasoning should be ONE sentence describing what data you used and why you landed on the price.`;

const SUGGEST_TOOL = {
  name: "suggest_price",
  description: "Return a unit price suggestion for the requested quote line.",
  input_schema: {
    type: "object",
    properties: {
      suggested_price: { type: "number", minimum: 0 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reasoning: { type: "string" },
    },
    required: ["suggested_price", "confidence", "reasoning"],
  },
} as const;

const SuggestResultSchema = z.object({
  suggested_price: z.number().min(0),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type SuggestResult = z.infer<typeof SuggestResultSchema>;

function qtyTier(qty: number): string {
  if (qty < 10) return "1-9";
  if (qty < 50) return "10-49";
  if (qty < 100) return "50-99";
  if (qty < 500) return "100-499";
  return "500+";
}

export async function suggestPrice(args: {
  part_id: string;
  qty: number;
  customer_id: string;
}): Promise<SuggestResult> {
  const supabase = createAdminClient();

  const [partRes, historyRes, vendorRes, customerRes] = await Promise.all([
    supabase
      .from("parts")
      .select("internal_pn, description")
      .eq("id", args.part_id)
      .maybeSingle(),
    supabase
      .from("quote_lines")
      .select(
        "qty, unit_price, created_at, quotes!inner(customer_id, customers!inner(name))",
      )
      .eq("part_id", args.part_id)
      .not("unit_price", "is", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("vendor_quotes")
      .select(
        "unit_price, lead_time_days, quoted_at, vendors!inner(name)",
      )
      .eq("part_id", args.part_id)
      .order("quoted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("name")
      .eq("id", args.customer_id)
      .maybeSingle(),
  ]);

  if (!partRes.data) throw new Error("Part not found");

  type HistoryRow = {
    qty: number;
    unit_price: number;
    created_at: string;
    quotes: { customer_id: string; customers: { name: string } };
  };
  type VendorRow = {
    unit_price: number;
    lead_time_days: number | null;
    quoted_at: string;
    vendors: { name: string };
  } | null;

  const history = (historyRes.data ?? []) as unknown as HistoryRow[];
  const vendor = vendorRes.data as unknown as VendorRow;

  // Build the per-call context. Static system prompt is cache-controlled.
  const ctx: string[] = [];
  ctx.push(
    `Part: ${partRes.data.internal_pn}${partRes.data.description ? ` — ${partRes.data.description}` : ""}`,
  );
  ctx.push(
    `Customer: ${customerRes.data?.name ?? "(unknown)"}`,
  );
  ctx.push(`Qty asked: ${args.qty} (tier ${qtyTier(args.qty)})`);
  ctx.push("");
  ctx.push("Last 5 customer quotes for this part:");
  if (history.length === 0) {
    ctx.push("- (no history)");
  } else {
    for (const h of history) {
      ctx.push(
        `- ${h.created_at.slice(0, 10)} · ${h.quotes.customers.name} · qty ${h.qty} · $${h.unit_price.toFixed(4)}`,
      );
    }
  }
  ctx.push("");
  ctx.push("Latest vendor cost:");
  if (!vendor) {
    ctx.push("- (no vendor quotes logged)");
  } else {
    ctx.push(
      `- ${vendor.quoted_at.slice(0, 10)} · ${vendor.vendors.name} · $${vendor.unit_price.toFixed(4)}${vendor.lead_time_days != null ? ` · ${vendor.lead_time_days}d lead` : ""}`,
    );
  }

  const client = getAnthropic();
  const response = await client.messages.create({
    model: MODELS.classification, // Haiku — cheap for this reasoning task
    max_tokens: 1024,
    tools: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      SUGGEST_TOOL as any,
    ],
    tool_choice: { type: "tool", name: SUGGEST_TOOL.name },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: ctx.join("\n") }],
  });

  const toolUse = response.content.find(
    (c): c is Extract<typeof c, { type: "tool_use" }> => c.type === "tool_use",
  );
  if (!toolUse) throw new Error("Anthropic response missing tool_use block");

  return SuggestResultSchema.parse(toolUse.input);
}
