import { z } from "zod";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { retry } from "@/lib/retry";
import { trackLlmCall } from "@/lib/llm-telemetry";
import { createAdminClient } from "@/lib/supabase/admin";
import { qtyTier, readPriceCache, writePriceCache } from "./cache";

const SYSTEM_PROMPT = `You are a pricing assistant for CAP Hardware Supply (hardware/fastener distributor). Suggest a customer-facing unit price for a single quote line.

Inputs you'll see:
- The internal part description
- The customer (plus any customer-specific pricing rules — markup multiplier, flat discount %, free-text pricing notes)
- Last 5 customer quotes for the same part (cross-customer)
- Latest vendor cost (your cost basis)
- The qty tier

Principles:
- Markup over latest vendor cost, consistent with recent quotes.
- Larger qty tiers → lower markup (volume discount).
- Wide-variance history → weight more recent prices higher.
- No vendor cost AND no history → confidence < 0.5, best guess from description.
- Only vendor cost → ~25% default markup, explain.
- Only history → follow the most recent comparable, explain.
- Round to 4 decimal places.

Customer-specific pricing rules (apply AFTER computing the baseline price):
- Multiply by markup_multiplier (1.000 = no change, >1 = above baseline, <1 = below).
- Then subtract discount_pct from the result.
- Pricing notes are free-text instructions from Jim (e.g. "never quote below cost", "match Acme's last price"). Treat as overriding guidance.
- Mention which adjustments you applied in the reasoning if multiplier != 1.000 OR discount_pct > 0.

Per-part target margin (apply as a floor sanity check):
- target_margin_pct is the minimum margin Jim wants on this part.
- Margin = (price - vendor_cost) / price × 100.
- If your suggested price would yield a margin below target_margin_pct, nudge the price up so the resulting margin >= target_margin_pct, UNLESS history strongly suggests Jim quotes this part below target (in which case explain the override).
- Mention the resulting margin in reasoning when the floor was applied.

Output via the suggest_price tool. Reasoning is ONE sentence describing the data used, any customer adjustments applied, and why the price.`;

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

export async function suggestPrice(args: {
  part_id: string;
  qty: number;
  customer_id: string;
}): Promise<SuggestResult> {
  // Cache check — invalidated by triggers when vendor_quotes or quote_lines
  // for this part change, so the cached value is always consistent with
  // current inputs.
  const cached = await readPriceCache(args);
  if (cached) return cached;

  const supabase = createAdminClient();

  const [partRes, historyRes, vendorRes, customerRes] = await Promise.all([
    supabase
      .from("parts")
      .select("internal_pn, short_description, target_margin_pct")
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
      .select("name, markup_multiplier, discount_pct, pricing_notes")
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

  const ctx: string[] = [];
  const part = partRes.data as {
    internal_pn: string;
    short_description: string | null;
    target_margin_pct: number | string;
  };
  ctx.push(
    `Part: ${part.internal_pn}${part.short_description ? ` — ${part.short_description}` : ""}`,
  );
  ctx.push(`Target margin: ${Number(part.target_margin_pct).toFixed(1)}%`);
  const customer = customerRes.data as
    | {
        name: string;
        markup_multiplier: number | string;
        discount_pct: number | string;
        pricing_notes: string | null;
      }
    | null;
  ctx.push(`Customer: ${customer?.name ?? "(unknown)"}`);
  if (customer) {
    const mm = Number(customer.markup_multiplier ?? 1);
    const dp = Number(customer.discount_pct ?? 0);
    ctx.push(
      `Customer pricing rules: markup_multiplier=${mm.toFixed(3)} · discount_pct=${dp.toFixed(2)}%${customer.pricing_notes ? `\n  Notes: ${customer.pricing_notes}` : ""}`,
    );
  }
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
  const response = await trackLlmCall(
    "price_suggest",
    MODELS.classification,
    () =>
      retry(() =>
        client.messages.create({
          model: MODELS.classification, // Haiku
          max_tokens: 1024,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: [SUGGEST_TOOL as any],
          tool_choice: { type: "tool", name: SUGGEST_TOOL.name },
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: ctx.join("\n") }],
        }),
      ),
  );

  const toolUse = response.content.find(
    (c): c is Extract<typeof c, { type: "tool_use" }> => c.type === "tool_use",
  );
  if (!toolUse) throw new Error("Anthropic response missing tool_use block");

  const result = SuggestResultSchema.parse(toolUse.input);
  await writePriceCache({ ...args, result });
  return result;
}
