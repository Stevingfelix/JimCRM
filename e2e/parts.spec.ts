import { test, expect } from "@playwright/test";

test.describe("Parts", () => {
  test("list page loads", async ({ page }) => {
    await page.goto("/parts");
    await expect(page.getByText("Parts catalog")).toBeVisible();
  });

  test("can create a part", async ({ page }) => {
    const pn = `E2E-TEST-${Date.now()}`;

    await page.goto("/parts/new");
    await page.getByLabel(/internal p/i).fill(pn);
    await page.getByLabel(/description/i).fill("Playwright test part");
    await page.getByRole("button", { name: /save|create/i }).first().click();

    // Should redirect to detail page showing the PN
    await page.waitForURL(/\/parts\/[a-f0-9-]+/, { timeout: 10_000 });
    await expect(page.locator("body")).toContainText(pn);
  });
});
