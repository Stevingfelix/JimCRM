import { test, expect } from "@playwright/test";

test.describe("Public quote view", () => {
  // This test requires a valid public share token. Skip by default;
  // set E2E_PUBLIC_QUOTE_TOKEN to enable.
  const token = process.env.E2E_PUBLIC_QUOTE_TOKEN;

  test("renders without auth", async ({ browser }) => {
    test.skip(!token, "Set E2E_PUBLIC_QUOTE_TOKEN to run this test");

    // Fresh context — no stored auth
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/q/${token}`);
    await expect(page.locator("body")).toContainText(/quote|total|subtotal/i);
    await ctx.close();
  });
});
