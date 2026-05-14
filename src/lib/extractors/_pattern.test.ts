import { describe, it, expect } from "vitest";
import {
  ExtractedLineSchema,
  ExtractionResultSchema,
  REVIEW_CONFIDENCE_THRESHOLD,
} from "./_pattern";

describe("ExtractedLineSchema sanitize", () => {
  const base = {
    raw_text: "500 of CAP-2210 @ $0.18",
    part_number_guess: "CAP-2210",
    qty: 500,
    unit_price: 0.18,
    confidence: 0.9,
    reasoning: "Clear line item.",
  };

  it("passes through a clean line unchanged", () => {
    const parsed = ExtractedLineSchema.parse(base);
    expect(parsed.qty).toBe(500);
    expect(parsed.unit_price).toBe(0.18);
    expect(parsed.confidence).toBe(0.9);
    expect(parsed.part_number_guess).toBe("CAP-2210");
    expect(parsed.reasoning).toBe("Clear line item.");
  });

  it("nulls absurdly large qty + floors confidence + appends warning", () => {
    const parsed = ExtractedLineSchema.parse({ ...base, qty: 5_000_000 });
    expect(parsed.qty).toBeNull();
    expect(parsed.confidence).toBeLessThan(REVIEW_CONFIDENCE_THRESHOLD);
    expect(parsed.reasoning).toContain("absurd qty");
  });

  it("nulls negative qty", () => {
    const parsed = ExtractedLineSchema.parse({ ...base, qty: -3 });
    expect(parsed.qty).toBeNull();
    expect(parsed.reasoning).toContain("negative qty");
  });

  it("nulls absurd unit_price", () => {
    const parsed = ExtractedLineSchema.parse({ ...base, unit_price: 9_999_999 });
    expect(parsed.unit_price).toBeNull();
    expect(parsed.reasoning).toContain("absurd unit_price");
  });

  it("nulls negative unit_price", () => {
    const parsed = ExtractedLineSchema.parse({ ...base, unit_price: -5 });
    expect(parsed.unit_price).toBeNull();
    expect(parsed.reasoning).toContain("negative unit_price");
  });

  it("nulls part number that looks like a date", () => {
    const parsed = ExtractedLineSchema.parse({
      ...base,
      part_number_guess: "05/14/2026",
    });
    expect(parsed.part_number_guess).toBeNull();
    expect(parsed.reasoning).toContain("date");
  });

  it("nulls part number that looks like a phone number", () => {
    const parsed = ExtractedLineSchema.parse({
      ...base,
      part_number_guess: "555-123-4567",
    });
    expect(parsed.part_number_guess).toBeNull();
    expect(parsed.reasoning).toContain("phone");
  });

  it("truncates an overly-long part number to 120 chars", () => {
    const long = "X".repeat(300);
    const parsed = ExtractedLineSchema.parse({
      ...base,
      part_number_guess: long,
    });
    expect(parsed.part_number_guess?.length).toBe(120);
    expect(parsed.reasoning).toContain("truncated");
  });

  it("does NOT flag a normal PN with hyphens and digits", () => {
    const parsed = ExtractedLineSchema.parse({
      ...base,
      part_number_guess: "91251A537",
    });
    expect(parsed.part_number_guess).toBe("91251A537");
    expect(parsed.confidence).toBe(0.9);
  });

  it("trims whitespace from part_number_guess", () => {
    const parsed = ExtractedLineSchema.parse({
      ...base,
      part_number_guess: "  CAP-2210  ",
    });
    expect(parsed.part_number_guess).toBe("CAP-2210");
  });

  it("treats empty-string part_number_guess as null", () => {
    const parsed = ExtractedLineSchema.parse({
      ...base,
      part_number_guess: "",
    });
    expect(parsed.part_number_guess).toBeNull();
  });
});

describe("ExtractionResultSchema", () => {
  it("accepts a valid result", () => {
    const result = ExtractionResultSchema.parse({
      source_type: "customer_quote_request",
      customer_or_vendor_hint: "Acme",
      lines: [
        {
          raw_text: "500 of CAP-2210",
          part_number_guess: "CAP-2210",
          qty: 500,
          unit_price: null,
          confidence: 0.85,
          reasoning: "Looks like a quote request.",
        },
      ],
    });
    expect(result.source_type).toBe("customer_quote_request");
    expect(result.lines).toHaveLength(1);
  });

  it("rejects an unknown source_type", () => {
    expect(() =>
      ExtractionResultSchema.parse({
        source_type: "spam",
        customer_or_vendor_hint: null,
        lines: [],
      }),
    ).toThrow();
  });

  it("sanitizes every line in the array", () => {
    const result = ExtractionResultSchema.parse({
      source_type: "other",
      customer_or_vendor_hint: null,
      lines: [
        {
          raw_text: "junk",
          part_number_guess: "05/14/2026",
          qty: 999_999_999,
          unit_price: -1,
          confidence: 0.9,
          reasoning: "",
        },
      ],
    });
    expect(result.lines[0].part_number_guess).toBeNull();
    expect(result.lines[0].qty).toBeNull();
    expect(result.lines[0].unit_price).toBeNull();
    expect(result.lines[0].confidence).toBeLessThan(REVIEW_CONFIDENCE_THRESHOLD);
  });
});
