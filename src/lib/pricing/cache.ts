import { createAdminClient } from "@/lib/supabase/admin";
import type { SuggestResult } from "./suggest";

export function qtyTier(qty: number): string {
  if (qty < 10) return "1-9";
  if (qty < 50) return "10-49";
  if (qty < 100) return "50-99";
  if (qty < 500) return "100-499";
  return "500+";
}

export async function readPriceCache(args: {
  part_id: string;
  qty: number;
  customer_id: string;
}): Promise<SuggestResult | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("price_suggestion_cache")
      .select("suggested_price, confidence, reasoning")
      .eq("part_id", args.part_id)
      .eq("qty_bucket", qtyTier(args.qty))
      .eq("customer_id", args.customer_id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      suggested_price: Number(data.suggested_price),
      confidence: Number(data.confidence),
      reasoning: data.reasoning,
    };
  } catch {
    return null;
  }
}

export async function writePriceCache(args: {
  part_id: string;
  qty: number;
  customer_id: string;
  result: SuggestResult;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("price_suggestion_cache").upsert(
      {
        part_id: args.part_id,
        qty_bucket: qtyTier(args.qty),
        customer_id: args.customer_id,
        suggested_price: args.result.suggested_price,
        confidence: args.result.confidence,
        reasoning: args.result.reasoning,
      },
      { onConflict: "part_id,qty_bucket,customer_id" },
    );
  } catch {
    // cache write must never fail the suggestion
  }
}
