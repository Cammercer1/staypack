import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390, 320]) {
  test(`digital proposal preview works at ${width}px without API requests`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", route => { errors.push(`Unexpected API request: ${route.request().url()}`); return route.abort(); });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/dev/str-proposal");
    const proposal = page.getByTestId("digital-proposal");
    await expect(proposal.getByRole("heading", { name: "42 Ocean Parade, Burleigh Heads" })).toBeVisible();
    await expect(proposal.getByText("Short-term rental proposal prepared for Jordan Taylor", { exact: true })).toBeVisible();
    await expect(proposal.getByTestId("scenario-ltr")).toContainText("$59,800");
    await expect(proposal.getByTestId("scenario-market")).toContainText("$98,500");
    await expect(proposal.getByTestId("scenario-managed")).toContainText("$113,275");
    await proposal.getByRole("button", { name: "Monthly", exact: true }).click();
    await expect(proposal.getByTestId("scenario-managed")).toContainText("$9,440");
    await proposal.getByTestId("rental-chart").scrollIntoViewIfNeeded();
    await expect(proposal.locator(".apexcharts-canvas")).toBeVisible();
    await proposal.getByRole("button", { name: "Gross yield", exact: true }).click();
    await expect(proposal.getByTestId("scenario-ltr")).toContainText("4.8%");
    await expect(proposal.getByTestId("scenario-managed")).toContainText("9.1%");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await proposal.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await proposal.getByRole("button", { name: "Annual", exact: true }).click();
    const monthlyChart = proposal.getByTestId("monthly-revenue-chart");
    await monthlyChart.scrollIntoViewIfNeeded();
    await expect(monthlyChart.locator(".apexcharts-canvas")).toBeVisible();
    await proposal.getByText("View monthly figures", { exact: true }).click();
    await expect(proposal.getByRole("table").locator("tbody tr")).toHaveCount(12);
    expect(await proposal.getByRole("table").evaluate(table => {
      const rows = [...table.querySelectorAll("tbody tr")].map(row => [...row.querySelectorAll("td")].map(cell => Number(cell.textContent?.replace(/[^\d.-]/g, ""))));
      return [0, 1, 2].map(index => rows.reduce((sum, row) => sum + row[index], 0));
    })).toEqual([59800, 98500, 113275]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await proposal.getByText("View monthly figures", { exact: true }).click();
    await proposal.screenshot({ path: testInfo.outputPath(`proposal-${width}.png`) });
    if (width < 1024) await page.getByRole("button", { name: "Edit template", exact: true }).click();
    await page.getByLabel("Preview data", { exact: true }).selectOption("incomplete");
    if (width < 1024) await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(proposal.getByTestId("scenario-ltr")).toContainText("Not available");
    await proposal.getByRole("button", { name: "Gross yield", exact: true }).click();
    await expect(proposal.getByText("Add an estimated property value to compare gross yields.")).toBeVisible();
    if (width < 1024) await page.getByRole("button", { name: "Edit template", exact: true }).click();
    await page.getByLabel("Preview data", { exact: true }).selectOption("general");
    if (width < 1024) await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(proposal.getByText(/prepared for/i)).toHaveCount(0);
    await expect(proposal.getByText("Short-term rental proposal", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("brand overrides, tokens, save/restore and export/import round-trip", async ({ page }) => {
  await page.goto("/dev/str-proposal");
  const primary = page.getByLabel("Primary colour", { exact: true });
  await primary.fill("#663344");
  await page.getByLabel("Brand preset", { exact: true }).selectOption("coastal");
  await expect(primary).toHaveValue("#663344");
  await page.getByRole("button", { name: "Reset primary colour", exact: true }).click();
  await expect(primary).toHaveValue("#23586a");
  await page.getByLabel("Brand preset", { exact: true }).selectOption("staypack");
  await expect(primary).toHaveValue("#095b42");
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.getByLabel("Hero heading", { exact: true }).fill("Your rental appraisal for ");
  await page.getByLabel("Insert data token").selectOption("recipient.displayName");
  await expect(page.getByTestId("digital-proposal").getByRole("heading", { level: 1 })).toHaveText("Your rental appraisal for Jordan Taylor");
  await page.getByLabel("Hero layout").selectOption("panorama");
  await page.getByLabel("Starting comparison").selectOption("monthly");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved locally in this browser" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("digital-proposal").getByRole("heading", { level: 1 })).toHaveText("Your rental appraisal for Jordan Taylor");
  await expect(page.getByTestId("scenario-managed")).toContainText("$9,440");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const path = await (await download).path();
  expect(path).toBeTruthy();
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.getByLabel("Hero heading", { exact: true }).fill("{{recipient.email}}");
  await expect(page.getByRole("complementary", { name: "Template settings" }).getByRole("alert")).toContainText("unknown token");
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();
  await page.getByLabel("Import template JSON").setInputFiles(path!);
  await expect(page.getByTestId("digital-proposal").getByRole("heading", { level: 1 })).toHaveText("Your rental appraisal for Jordan Taylor");
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
});

test("device previews, reduced motion and invalid import preserve the draft", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/str-proposal");
  const proposal = page.getByTestId("digital-proposal");
  for (const device of ["Phone", "Tablet", "Desktop"]) {
    await page.getByRole("button", { name: `${device} preview`, exact: true }).click();
    const box = await proposal.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(device === "Phone" ? 390 : device === "Tablet" ? 768 : 1440);
    expect(await proposal.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.getByLabel("Import template JSON").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"version":2}') });
  await expect(page.getByRole("status").filter({ hasText: "version" })).toBeVisible();
  await expect(proposal.getByRole("heading", { level: 1 })).toHaveText("42 Ocean Parade, Burleigh Heads");
});
