import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`assumption editor applies and discards drafts at ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      errors.push(`Unexpected real API: ${route.request().url()}`);
      await route.abort();
    });
    await page.setViewportSize(viewport);
    await page.goto("/dev/lint-regression", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Start mock test session" }).click();
    await page.getByLabel("Test screen").selectOption("str-new");
    await page.getByRole("group", { name: "Property step actions" }).getByRole("button", { name: "Continue to review estimate" }).click();
    const trigger = page.getByRole("button", { name: "Adjust estimate", exact: true });
    const dialog = page.getByRole("dialog", { name: "Adjust estimate" });
    await expect(page.getByLabel("Management uplift (%)", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Estimate step actions" }).getByRole("button", { name: "Use this estimate", exact: true })).toBeVisible();
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Management uplift (%)", { exact: true })).toBeVisible();
    const adr = dialog.getByLabel("Average daily rate · ADR ($)", { exact: true });
    const occupancy = dialog.getByLabel("Estimated occupancy (%)", { exact: true });
    const originalAdr = await adr.inputValue();
    const originalOccupancy = await occupancy.inputValue();
    const apply = dialog.getByRole("button", { name: "Apply changes", exact: true });
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const applyBox = await apply.boundingBox();
    expect(applyBox!.y + applyBox!.height).toBeLessThanOrEqual(viewport.height);
    await adr.fill("400");
    await occupancy.fill("75");
    await expect(dialog.getByText("$109,500 / year", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("assumptions-editor.png") });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(adr).toHaveValue(originalAdr);
    await expect(occupancy).toHaveValue(originalOccupancy);
    await adr.fill("");
    await expect(apply).toBeDisabled();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await trigger.click();
    await expect(adr).toHaveValue(originalAdr);
    await adr.fill("400");
    await occupancy.fill("75");
    await dialog.getByLabel("Basis for your management estimate", { exact: false }).fill("Reviewed rates and availability for this property.");
    await apply.click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(/^\$109,500\s*\/ year$/)).toBeVisible();
    await trigger.click();
    await expect(adr).toHaveValue("400");
    await expect(occupancy).toHaveValue("75");
    await expect(dialog.getByLabel("Basis for your management estimate", { exact: false })).toHaveValue("Reviewed rates and availability for this property.");
    await dialog.getByRole("button", { name: "Cancel assumption changes", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    const activity = await page.getByTestId("mock-requests").textContent();
    expect(activity?.match(/POST \/api\/str\/estimate/g)).toHaveLength(1);
    expect(activity).not.toContain("generate-copy");
    expect(errors).toEqual([]);
  });
}
