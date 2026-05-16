import { createAdminClient } from "@/lib/supabase/admin";

// Anthropic published per-MTok pricing (Jan 2026). Adjust if pricing changes.
// These are the public list rates — actual billed rates may differ for
// volume discounts.
const PRICING: Record<
  string,
  {
    input: number;
    output: number;
    cache_write: number;
    cache_read: number;
  }
> = {
  // Sonnet 4.6 / 4.7
  "claude-sonnet-4-6": { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 },
  "claude-sonnet-4-7": { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 },
  // Haiku 4.5
  "claude-haiku-4-5-20251001": {
    input: 1,
    output: 5,
    cache_write: 1.25,
    cache_read: 0.1,
  },
  // Opus 4.x (rarely used here, included for completeness)
  "claude-opus-4-7": {
    input: 15,
    output: 75,
    cache_write: 18.75,
    cache_read: 1.5,
  },
};

export type LlmCallType =
  | "email_body"
  | "pdf_attachment"
  | "excel_attachment"
  | "image_attachment"
  | "price_suggest"
  | "triage";

export type Usage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export function estimateCostUsd(model: string, usage: Usage): number {
  const p = PRICING[model];
  if (!p) return 0;
  const input = (usage.input_tokens ?? 0) / 1_000_000;
  const output = (usage.output_tokens ?? 0) / 1_000_000;
  const cacheWrite = ((usage.cache_creation_input_tokens ?? 0) || 0) / 1_000_000;
  const cacheRead = ((usage.cache_read_input_tokens ?? 0) || 0) / 1_000_000;
  return Math.round(
    (input * p.input +
      output * p.output +
      cacheWrite * p.cache_write +
      cacheRead * p.cache_read) *
      1_000_000,
  ) / 1_000_000;
}

export async function trackLlmCall<T>(
  call_type: LlmCallType,
  model: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const response = await fn();
    const usage = ((response as { usage?: Usage })?.usage ?? {}) as Usage;
    // Fire-and-forget; never block extraction on telemetry.
    void logLlmCall({
      call_type,
      model,
      usage,
      succeeded: true,
      duration_ms: Date.now() - start,
    });
    return response;
  } catch (e) {
    void logLlmCall({
      call_type,
      model,
      usage: {},
      succeeded: false,
      error_message: e instanceof Error ? e.message : "unknown",
      duration_ms: Date.now() - start,
    });
    throw e;
  }
}

export async function logLlmCall(input: {
  call_type: LlmCallType;
  model: string;
  usage: Usage;
  related_id?: string | null;
  succeeded: boolean;
  error_message?: string | null;
  duration_ms?: number;
}): Promise<void> {
  // Best-effort: never let telemetry write failures break extraction.
  try {
    const supabase = createAdminClient();
    await supabase.from("llm_calls").insert({
      call_type: input.call_type,
      model: input.model,
      input_tokens: input.usage.input_tokens ?? 0,
      output_tokens: input.usage.output_tokens ?? 0,
      cache_creation_input_tokens:
        input.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: input.usage.cache_read_input_tokens ?? 0,
      estimated_cost_usd: estimateCostUsd(input.model, input.usage),
      related_id: input.related_id ?? null,
      succeeded: input.succeeded,
      error_message: input.error_message ?? null,
      duration_ms: input.duration_ms ?? null,
    });
  } catch {
    // swallow; telemetry must not impact extraction reliability
  }
}
