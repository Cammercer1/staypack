import { expect, test, type Page } from "@playwright/test";

// Uses the app's synthetic provider responses. No customer data or paid calls.
async function openDraft(page: Page) {
  await page.goto("/dev/lint-regression", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start mock test session" }).click();
  await page.getByLabel("Test screen").selectOption("str-new");
}

async function selectedStep(page: Page, name: string) {
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
}

for (const width of [1440, 390]) {
  test(`STR evidence before design: complete journey at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      errors.push(`Unexpected real API: ${route.request().url()}`);
      await route.abort();
    });
    await page.setViewportSize({ width, height: 1000 });
    await openDraft(page);
    await selectedStep(page, "Property");
    await expect(page.getByRole("button", { name: "Add customer" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Design & content" })).toBeDisabled();
    await expect(page.getByText("Choose your report design")).not.toBeVisible();
    await expect(page.getByLabel("Car spaces", { exact: true })).toHaveValue("2");
    await page.getByLabel("Car spaces", { exact: true }).fill("1");
    await page.getByLabel("Guest capacity", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Get estimate & evidence" }).click();
    await expect(page.getByText("Enter the guest capacity")).toBeVisible();
    await page.getByLabel("Guest capacity", { exact: true }).fill("8");
    await expect(page.getByText("Enter the guest capacity")).not.toBeVisible();
    await page.getByLabel("Long-term rent ($ / week)", { exact: true }).fill("925");
    await expect(page.getByText("$48,100 / year", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Pool", exact: true }).click();
    await page.getByRole("button", { name: "Air conditioning", exact: true }).click();
    await page.getByLabel("Add another amenity", { exact: true }).fill("Private tennis court");
    await page.getByLabel("Add another amenity", { exact: true }).press("Enter");
    await expect(page.getByRole("button", { name: "Remove Private tennis court", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("property.png"), fullPage: true });
    await page.getByRole("button", { name: "Get estimate & evidence" }).click();
    await selectedStep(page, "Estimate & evidence");
    await page.getByRole("tab", { name: "Property", exact: true }).click();
    await selectedStep(page, "Property");
    await expect(page.getByLabel("Car spaces", { exact: true })).toHaveValue("1");
    await expect(page.getByLabel("Long-term rent ($ / week)", { exact: true })).toHaveValue("925");
    await expect(page.getByRole("button", { name: "Pool", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Remove Private tennis court", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Review estimate & evidence" }).click();
    await selectedStep(page, "Estimate & evidence");
    await page.getByLabel("Management uplift (%)", { exact: true }).fill("20");
    const firstComp = page.getByRole("checkbox", { name: "Feature Coastal stay 1", exact: true });
    await firstComp.uncheck();
    await page.screenshot({ path: testInfo.outputPath("evidence.png"), fullPage: true });
    await page.getByRole("button", { name: "Use estimate & choose design" }).click();
    await selectedStep(page, "Design & content");
    await expect(page.getByText("Choose your report design")).toBeVisible();
    await expect(page.getByTestId("mock-requests")).not.toContainText("generate-copy");
    await expect(page.getByRole("tab", { name: "Review & share" })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Use design & write report" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("design.png"), fullPage: true });

    // Backtracking preserves the management assumption and the comp selection.
    await page.getByRole("button", { name: "Back to evidence" }).click();
    await selectedStep(page, "Estimate & evidence");
    await expect(firstComp).not.toBeChecked();
    await expect(page.getByLabel("Management uplift (%)", { exact: true })).toHaveValue("20");
    await page.getByRole("button", { name: "Use estimate & choose design" }).click();
    await selectedStep(page, "Design & content");
    await page.getByRole("button", { name: "Use design & write report" }).click();
    await expect(page.getByLabel("Heading", { exact: true })).toBeVisible();
    await page.getByLabel("Heading", { exact: true }).fill("Prepared for our coastal property owner");
    await page.getByRole("button", { name: "Change report design" }).click();
    await expect(page.getByText("Choose your report design")).toBeVisible();
    const alternatives = page.locator('[aria-label="Report designs"] button[aria-pressed="false"]');
    await alternatives.first().click();
    await page.getByRole("button", { name: "Use design & edit content" }).click();
    await expect(page.getByLabel("Heading", { exact: true })).toHaveValue("Prepared for our coastal property owner");
    await page.screenshot({ path: testInfo.outputPath("content.png"), fullPage: true });
    await page.getByRole("button", { name: "Review & download" }).click();
    await selectedStep(page, "Review & share");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Add customer" }).click();
    await page.getByLabel("Customer name", { exact: true }).fill("Jordan QA");
    await page.getByLabel("Email (optional)", { exact: true }).fill("jordan@example.test");
    await page.getByLabel("Phone (optional)", { exact: true }).fill("0412 345 678");
    await expect(page.getByRole("tab", { name: "Property", exact: true })).toBeDisabled();
    // Delivery is inert until the customer form is saved or cancelled.
    await expect(page.locator("aside[inert]")).toBeVisible();
    await expect(page.locator("aside[inert] button").filter({ hasText: "Publish online" })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("customer-edit.png"), fullPage: true });
    await page.getByRole("button", { name: "Save customer details" }).click();
    await expect(page.getByRole("heading", { name: "Prepared for Jordan QA" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish online" })).toBeEnabled();
    await page.getByRole("button", { name: "Edit customer" }).click();
    await page.getByLabel("Customer name", { exact: true }).fill("Unsaved name");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Prepared for Jordan QA" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Property", exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("review.png"), fullPage: true });
    const activity = await page.getByTestId("mock-requests").textContent();
    expect(activity?.match(/POST \/api\/str\/estimate/g)).toHaveLength(1);
    expect(activity?.match(/POST \/api\/reports\/mock-report\/generate-copy/g)).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}
