import { describe, it, expect } from "vitest";
import { estimateCostUsd } from "./llm-telemetry";

describe("estimateCostUsd", () => {
  it("returns 0 for unknown model", () => {
    expect(
      estimateCostUsd("claude-unknown-model", {
        input_tokens: 1000,
        output_tokens: 500,
      }),
    ).toBe(0);
  });

  it("computes Sonnet cost without cache", () => {
    // 1000 input × $3/MTok = $0.003
    // 500 output × $15/MTok = $0.0075
    const cost = estimateCostUsd("claude-sonnet-4-6", {
      input_tokens: 1000,
      output_tokens: 500,
    });
    expect(cost).toBeCloseTo(0.0105, 6);
  });

  it("applies cache discount on cache reads", () => {
    // Cache read 1000 tokens × $0.30/MTok = $0.0003 (vs $0.003 fresh)
    // 100 fresh input × $3/MTok = $0.0003
    // 500 output × $15/MTok = $0.0075
    const cost = estimateCostUsd("claude-sonnet-4-6", {
      input_tokens: 100,
      output_tokens: 500,
      cache_read_input_tokens: 1000,
    });
    expect(cost).toBeCloseTo(0.0081, 6);
  });

  it("charges cache write at 25% premium", () => {
    // 1000 cache_write × $3.75/MTok = $0.00375
    // 500 output × $15/MTok = $0.0075
    const cost = estimateCostUsd("claude-sonnet-4-6", {
      input_tokens: 0,
      output_tokens: 500,
      cache_creation_input_tokens: 1000,
    });
    expect(cost).toBeCloseTo(0.01125, 6);
  });

  it("handles null token counts gracefully", () => {
    const cost = estimateCostUsd("claude-haiku-4-5-20251001", {
      input_tokens: 300,
      output_tokens: 150,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    });
    // 300 × $1/MTok = $0.0003
    // 150 × $5/MTok = $0.00075
    expect(cost).toBeCloseTo(0.00105, 6);
  });

  it("Haiku is much cheaper than Sonnet for same usage", () => {
    const usage = { input_tokens: 1000, output_tokens: 500 };
    const haiku = estimateCostUsd("claude-haiku-4-5-20251001", usage);
    const sonnet = estimateCostUsd("claude-sonnet-4-6", usage);
    expect(haiku).toBeLessThan(sonnet);
    // Haiku is exactly 3x cheaper per token (input $1 vs $3, output $5 vs $15)
    expect(haiku * 3).toBeCloseTo(sonnet, 6);
  });
});
