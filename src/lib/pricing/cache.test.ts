import { describe, it, expect } from "vitest";
import { qtyTier } from "./cache";

describe("qtyTier", () => {
  it.each([
    [1, "1-9"],
    [5, "1-9"],
    [9, "1-9"],
    [10, "10-49"],
    [49, "10-49"],
    [50, "50-99"],
    [99, "50-99"],
    [100, "100-499"],
    [499, "100-499"],
    [500, "500+"],
    [1000, "500+"],
    [100_000, "500+"],
  ])("bucket for qty=%i is %s", (qty, expected) => {
    expect(qtyTier(qty)).toBe(expected);
  });
});
