import { expect, test, type Page } from "@playwright/test";

// Uses the app's synthetic provider responses. No customer data or paid calls.
async function openDraft(page: Page) {
  await page.goto("/dev/lint-regression", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Start mock test session" }).click();
  await page.getByLabel("Test screen").selectOption("str-new");
}

async function selectedStep(page: Page, name: string) {
  await expect(page.getByRole("tablist", { name: "Report creation steps" }).getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
}

async function selectSection(page: Page, label: string, name: string) {
  const tab = page.getByRole("tablist", { name: label, exact: true }).getByRole("tab", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

for (const width of [1440, 390]) {
  test(`STR evidence before proposal: complete journey at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      errors.push(`Unexpected real API: ${route.request().url()}`);
      await route.abort();
    });
    await page.setViewportSize({ width, height: 1000 });
    await openDraft(page);
    await selectedStep(page, "Confirm property");
    await expect(page.getByRole("region", { name: "Prepared for", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Edit property details", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Check proposal" })).toBeDisabled();
    await expect(page.getByText("Choose your report design")).not.toBeVisible();
    await expect(page.getByLabel("Car spaces", { exact: true })).toHaveValue("2");
    await page.getByLabel("Car spaces", { exact: true }).fill("1");
    await page.getByLabel("Guest capacity", { exact: true }).fill("0");
    await page.getByRole("group", { name: "Property step actions" }).getByRole("button", { name: "Continue to review estimate" }).click();
    await expect(page.getByText("Enter the guest capacity")).toBeVisible();
    await page.getByLabel("Guest capacity", { exact: true }).fill("8");
    await expect(page.getByText("Enter the guest capacity")).not.toBeVisible();
    await page.getByLabel("Long-term rent ($ / week)", { exact: true }).fill("925");
    await expect(page.getByText("$48,100 / year", { exact: false })).toBeVisible();
    await selectSection(page, "Property sections", "Amenities");
    await page.getByRole("button", { name: "Pool", exact: true }).click();
    await page.getByRole("button", { name: "Air conditioning", exact: true }).click();
    await page.getByLabel("Add another amenity", { exact: true }).fill("Private tennis court");
    await page.getByLabel("Add another amenity", { exact: true }).press("Enter");
    await expect(page.getByRole("button", { name: "Remove Private tennis court", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("property.png"), fullPage: true });
    await page.getByRole("group", { name: "Property step actions" }).getByRole("button", { name: "Continue to review estimate" }).click();
    await selectedStep(page, "Review estimate");
    await page.getByRole("tab", { name: "Confirm property", exact: true }).click();
    await selectedStep(page, "Confirm property");
    await selectSection(page, "Property sections", "Property details");
    await expect(page.getByLabel("Car spaces", { exact: true })).toHaveValue("1");
    await expect(page.getByLabel("Long-term rent ($ / week)", { exact: true })).toHaveValue("925");
    await selectSection(page, "Property sections", "Amenities");
    await expect(page.getByRole("button", { name: "Pool", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Remove Private tennis court", exact: true })).toBeVisible();
    await page.getByRole("group", { name: "Property step actions" }).getByRole("button", { name: "Continue to review estimate" }).click();
    await selectedStep(page, "Review estimate");
    await selectSection(page, "Estimate sections", "Estimate");
    await page.getByRole("button", { name: "Adjust estimate", exact: true }).click();
    await page.getByLabel("Management uplift (%)", { exact: true }).fill("20");
    await page.getByRole("button", { name: "Apply changes", exact: true }).click();
    await selectSection(page, "Estimate sections", "Comparables");
    const firstComp = page.getByRole("checkbox", { name: "Feature Coastal stay 1", exact: true });
    await expect(firstComp).toBeChecked();
    // Removing an included comparable also removes its checkbox from this view.
    await firstComp.click();
    await expect(firstComp).toHaveCount(0);
    await expect(page.getByRole("status", { name: "Included comparables", exact: true })).toHaveText("5 of 6 included");
    await page.screenshot({ path: testInfo.outputPath("evidence.png"), fullPage: true });
    await page.getByRole("group", { name: "Estimate step actions" }).getByRole("button", { name: "Use this estimate" }).click();
    await selectedStep(page, "Check proposal");
    await expect(page.getByRole("heading", { name: "Check your proposal", exact: true })).toBeVisible();
    await expect(page.getByTestId("mock-requests")).not.toContainText("generate-copy");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // Exercise validation in the rendered modal and document card at both viewport sizes.
    await page.getByRole("region", { name: "Proposal links", exact: true }).getByRole("button", { name: "Add link", exact: true }).click();
    const linkDialog = page.getByRole("dialog", { name: "Add a link", exact: true });
    await linkDialog.getByRole("button", { name: "Add link", exact: true }).click();
    await expect(linkDialog.getByRole("alert").filter({ hasText: "Enter a button label of up to 100 characters." })).toBeVisible();
    await expect(linkDialog.getByRole("alert").filter({ hasText: "Enter a full HTTPS link without a username or password." })).toBeVisible();
    await expect(linkDialog.getByLabel("Button label", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(linkDialog.getByLabel("Link URL", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await page.screenshot({ path: testInfo.outputPath("link-validation.png") });
    await linkDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(linkDialog).not.toBeVisible();
    const documents = page.getByRole("region", { name: "Proposal documents", exact: true });
    await documents.getByLabel("Upload PDF · up to 4 MB", { exact: true }).setInputFiles({ name: "invalid-proposal.txt", mimeType: "text/plain", buffer: Buffer.from("Not a PDF") });
    await expect(documents.getByRole("alert")).toHaveText("Choose a non-empty PDF document.");
    await expect(documents.getByRole("alert")).toBeVisible();
    await documents.screenshot({ path: testInfo.outputPath("document-validation.png") });
    await expect(page.getByTestId("mock-requests")).not.toContainText("POST /api/str/appraisals/mock-report/proposal/attachments");

    // Current proposal authoring preserves included pages and reviewed evidence.
    await page.getByRole("button", { name: /Edit pages/ }).click();
    const nextSteps = page.getByRole("checkbox", { name: "Include Next steps", exact: true });
    await nextSteps.uncheck();
    await page.getByRole("dialog", { name: "Edit pages", exact: true }).getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Review estimate", exact: true }).click();
    await selectedStep(page, "Review estimate");
    await selectSection(page, "Estimate sections", "Comparables");
    await page.getByRole("button", { name: "Browse other comparables", exact: true }).click();
    await expect(firstComp).not.toBeChecked();
    await selectSection(page, "Estimate sections", "Estimate");
    await page.getByRole("button", { name: "Adjust estimate", exact: true }).click();
    await expect(page.getByLabel("Management uplift (%)", { exact: true })).toHaveValue("20");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("group", { name: "Estimate step actions" }).getByRole("button", { name: "Use this estimate" }).click();
    await selectedStep(page, "Check proposal");
    await page.getByRole("button", { name: /Edit pages/ }).click();
    await expect(nextSteps).not.toBeChecked();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Preview proposal", exact: true }).click();
    await expect(page.getByText("Short-term rental property appraisal", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("proposal.png"), fullPage: true });
    await page.getByRole("button", { name: "Close preview", exact: true }).click();
    await page.getByRole("button", { name: "Continue to get link or PDF", exact: true }).click();
    await selectedStep(page, "Get link or PDF");
    await selectSection(page, "Sharing and activity", "Share proposal");
    const sharePanel = page.getByRole("region", { name: "Publish and share proposal", exact: true });
    await expect(sharePanel.getByRole("heading", { name: "Publish your proposal", exact: true })).toBeVisible();
    const preparedFor = sharePanel.getByRole("region", { name: "Prepared for", exact: true });
    await expect(preparedFor.getByText("Optional", { exact: true })).toBeVisible();
    await expect(sharePanel.getByRole("button", { name: "Publish proposal", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await preparedFor.getByRole("button", { name: "Add client", exact: true }).click();
    await page.getByRole("button", { name: "Add new contact", exact: true }).click();
    await page.getByLabel("Contact name", { exact: true }).fill("Jordan QA");
    await page.getByLabel("Email (optional)", { exact: true }).fill("jordan@example.test");
    await page.getByLabel("Phone (optional)", { exact: true }).fill("0412 345 678");
    // Inspect the modal's hidden background by DOM text, including the step number.
    await expect(page.locator('[role="tablist"][aria-label="Report creation steps"] [role="tab"]').filter({ hasText: /^1\s*Confirm property$/ })).toBeDisabled();
    await expect(page.locator('section[aria-label="Publish and share proposal"] button').filter({ hasText: /^Publish proposal$/ })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("customer-edit.png"), fullPage: true });
    await page.getByRole("button", { name: "Save contact details" }).click();
    await expect(preparedFor.getByText("Jordan QA", { exact: true })).toBeVisible();
    await expect(sharePanel.getByRole("button", { name: "Publish proposal", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Preview draft", exact: true }).click();
    await expect(page.getByText("Short-term rental property appraisal Prepared for Jordan QA", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close preview", exact: true }).click();
    await preparedFor.getByRole("button", { name: "Change client", exact: true }).click();
    await page.getByLabel("Contact name", { exact: true }).fill("Unsaved name");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(preparedFor.getByText("Jordan QA", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Confirm property", exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("review.png"), fullPage: true });
    const activity = await page.getByTestId("mock-requests").textContent();
    expect(activity?.match(/POST \/api\/str\/estimate/g)).toHaveLength(1);
    expect(activity).not.toContain("generate-copy");
    expect(activity).toContain("PUT /api/str/appraisals/mock-report/proposal");
    expect(activity).not.toContain("BLOCKED");
    expect(errors).toEqual([]);
  });
}
