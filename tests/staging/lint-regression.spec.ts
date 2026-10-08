import { expect, test, type Page } from "@playwright/test";

const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const failures: string[] = [];
  errors.set(page, failures);
  page.on("pageerror", (error) => failures.push(error.message));
  await page.route("**/api/**", async (route) => {
    failures.push(`Unmocked API request: ${route.request().url()}`);
    await route.abort();
  });
  await page.goto("/dev/lint-regression");
  await page.getByRole("button", { name: "Start mock test session" }).click();
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  await expect(page.getByTestId("mock-requests")).not.toContainText("BLOCKED");
});

async function openCase(page: Page, name: string) {
  await page.getByLabel("Test screen").selectOption(name);
}

async function closeDialog(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
}

test("brochure templates render and reset pagination after a template change", async ({ page }) => {
  const select = page.getByLabel("Brochure template");
  const options = await select.locator("option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value));
  for (const id of options) {
    await select.selectOption(id);
    await expect(page.locator(".report-page").first()).toBeVisible();
    const next = page.getByRole("button", { name: "Next →" });
    if (await next.count()) {
      await expect(page.getByText("Page 1 of 2")).toBeVisible();
      await next.click();
      await expect(page.getByText("Page 2 of 2")).toBeVisible();
    }
  }
});

test("brochure copy edits save and survive a preview refresh", async ({ page }) => {
  await openCase(page, "editor");
  const editable = page.locator('[contenteditable="true"]').first();
  await expect(editable).toBeVisible();
  await editable.fill("Mock saved heading");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByTestId("mock-requests")).toContainText("PATCH /api/collateral/mock-collateral");
  await expect(editable).toHaveText("Mock saved heading");
});

test("wizard moves between content and preview without losing its document", async ({ page }) => {
  await openCase(page, "wizard");
  await expect(page.getByRole("tab", { name: "Preview & publish" })).toBeVisible();
  await page.getByRole("tab", { name: "Content generation" }).click();
  await expect(page.locator('[contenteditable="true"]').first()).toBeVisible();
  await page.getByRole("tab", { name: "Preview & publish" }).click();
  await expect(page.locator(".report-page").first()).toBeVisible();
});

test("report pagination resets and inline text flushes on blur", async ({ page }) => {
  await openCase(page, "report");
  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.getByLabel("Report template").selectOption({ index: 1 });
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  const editable = page.locator('[contenteditable="true"]').first();
  await editable.fill("Mock report heading");
  await page.getByRole("heading", { name: "StayPack mock regression preview" }).click();
  await expect(page.getByTestId("edited-report")).toHaveText("Mock report heading");
});

test("mobile gallery can open, close and reopen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCase(page, "gallery");
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /Show All Photos/ }).filter({ visible: true }).click();
    await expect(page.getByText(/photos · 42 Oceanview/)).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
});

test("landing template selection resets on cancel and persists on save", async ({ page }) => {
  await openCase(page, "landing");
  await page.getByRole("button", { name: "Preview templates" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Classic", exact: true }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", /template=classic/);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Preview templates" }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", /template=minimal/);
  await page.getByRole("button", { name: "Classic", exact: true }).click();
  await page.getByRole("button", { name: "Use this template" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Preview templates" }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", /template=classic/);
  await expect(page.getByRole("button", { name: "Current template" })).toBeDisabled();
  await expect(page.getByTestId("mock-requests")).toContainText("PATCH /api/listings/mock-listing");
});

test("listing agent draft cancels cleanly and edited details save", async ({ page }) => {
  await openCase(page, "agents");
  await page.getByRole("button", { name: /^H Harvey Specter/ }).click();
  await page.locator("#strip-agent-name").fill("Unsaved name");
  await closeDialog(page);
  await page.getByRole("button", { name: /^H Harvey Specter/ }).click();
  await expect(page.locator("#strip-agent-name")).toHaveValue("Harvey Specter");
  await page.locator("#strip-agent-name").fill("Mock Updated Agent");
  await page.getByRole("button", { name: "Save agent" }).click();
  await expect(page.getByRole("button", { name: /^M Mock Updated Agent/ })).toBeVisible();
  await expect(page.getByTestId("mock-requests")).toContainText("PATCH /api/listings/mock-listing");
});

test("unknown-agent dialog resets saved and skipped choices when reopened", async ({ page }) => {
  await openCase(page, "unknown-agents");
  await page.getByRole("button", { name: "Review scraped agents" }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("completion")).toContainText("Mock New Agent");
  await page.getByRole("button", { name: "Review scraped agents" }).click();
  await expect(page.getByLabel("Name *", { exact: true })).toBeEnabled();
  await page.getByLabel("Name *", { exact: true }).fill("Mock Saved Agent");
  await page.getByRole("button", { name: "Add agent", exact: true }).click();
  await expect(page.getByTestId("mock-requests")).toContainText("POST /api/agents");
  await expect(page.getByTestId("completion")).toContainText("Mock Saved Agent");
});

test("brand dialog cancels and saves, and font search clears stale results", async ({ page }) => {
  await openCase(page, "branding");
  await page.getByRole("button", { name: "Advanced settings", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#adv_button_bg").fill("#123456");
  await closeDialog(page);
  await page.getByRole("button", { name: "Advanced settings", exact: true }).click();
  await expect(page.locator("#adv_button_bg")).not.toHaveValue("#123456");
  await page.locator("#adv_button_bg").fill("#123456");
  await page.getByRole("button", { name: "Save advanced settings" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Advanced settings", exact: true }).click();
  await expect(page.locator("#adv_button_bg")).toHaveValue("#123456");
  await closeDialog(page);
  const search = page.getByPlaceholder("Type 2+ letters to search Google Fonts").first();
  await search.fill("Mock");
  await expect(page.getByRole("button", { name: "Mock Sans", exact: true })).toBeVisible();
  await search.fill("M");
  await expect(page.getByRole("button", { name: "Mock Sans", exact: true })).toHaveCount(0);
  await search.fill("Mock");
  await page.getByRole("button", { name: "Mock Sans", exact: true }).click();
  await expect(search).toHaveValue("");
});

test("analytics loads presets and custom date ranges", async ({ page }) => {
  await openCase(page, "analytics");
  await expect(page.getByText("240", { exact: true })).toBeVisible();
  const period = page.getByRole("combobox").last();
  await period.selectOption("today");
  await expect(page.getByText("240", { exact: true })).toBeVisible();
  await period.selectOption("custom");
  const dates = page.locator('input[type="date"]');
  await dates.nth(0).fill("2026-10-01");
  await dates.nth(1).fill("2026-10-07");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("5.0%", { exact: true })).toBeVisible();
});

test("lead status updates through the mocked save endpoint", async ({ page }) => {
  await openCase(page, "leads");
  await expect(page.getByText("Mock Buyer")).toBeVisible();
  await page.getByRole("button", { name: /^Mock Buyer/ }).click();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: "Contacted" }).click();
  await expect(page.getByRole("button", { name: "Contacted", exact: true })).toBeEnabled();
  await expect(page.getByTestId("mock-requests")).toContainText("PATCH /api/leads/mock-lead");
});

test("scrape progress restarts from its first step", async ({ page }) => {
  await openCase(page, "progress");
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Run mock import" }).click();
    await expect(page.getByText("Reading listing URL…")).toBeVisible();
    await expect(page.getByText("Fetching property data…")).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
  }
});

test("social agent picker loads and can be reopened", async ({ page }) => {
  await openCase(page, "social");
  await page.getByRole("button", { name: /^Agent / }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Load from team" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Harvey Specter/ }).click();
    await expect(page.locator("#social-agent-name")).toHaveValue("Harvey Specter");
  }
  await expect(page.getByTestId("mock-requests")).toContainText("GET /api/agents");
});
