import { test, expect } from "@playwright/test";

test.describe("Customers", () => {
  test("list page loads", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.locator("body")).toContainText(/customer/i);
  });

  test("can open customer detail", async ({ page }) => {
    await page.goto("/customers");

    const firstRow = page.locator("a[href*='/customers/']").first();
    if (await firstRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForURL(/\/customers\/[a-f0-9-]+/);
      // Pricing rules section should be visible on customer detail
      await expect(page.locator("body")).toContainText(/markup|pricing/i);
    }
  });
});
