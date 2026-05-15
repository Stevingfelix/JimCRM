import { test, expect } from "@playwright/test";

test.describe("Vendors", () => {
  test("list page loads", async ({ page }) => {
    await page.goto("/vendors");
    await expect(page.locator("body")).toContainText(/vendor/i);
  });
});
