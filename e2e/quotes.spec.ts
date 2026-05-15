import { test, expect } from "@playwright/test";

test.describe("Quotes", () => {
  test("list page loads", async ({ page }) => {
    await page.goto("/quotes");
    await expect(page.getByRole("columnheader", { name: "Quote" })).toBeVisible();
  });

  test("can create a draft quote", async ({ page }) => {
    await page.goto("/quotes/new");

    // Pick first customer
    const customerSelect = page.locator("[name='customer_id'], [data-name='customer']").first();
    if (await customerSelect.isVisible()) {
      await customerSelect.click();
      await page.locator("[role='option']").first().click();
    }

    // Add a line — click the add-line button
    const addBtn = page.getByRole("button", { name: /add line/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
    }

    // Save the quote
    const saveBtn = page.getByRole("button", { name: /save|create/i }).first();
    await saveBtn.click();

    // Should redirect to quote detail
    await page.waitForURL(/\/quotes\/[a-f0-9-]+/, { timeout: 10_000 });
    await expect(page.locator("body")).toContainText(/draft/i);
  });

  test("CSV export link responds", async ({ page }) => {
    const response = await page.request.get("/api/export/csv");
    expect(response.status()).toBeLessThan(500);
  });
});
