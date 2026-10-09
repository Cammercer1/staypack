import { expect, test, type Page } from "@playwright/test";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const failures: string[] = [];
  errors.set(page, failures);
  page.on("pageerror", (error) => failures.push(error.message));
  await page.route("**/api/**", async (route) => {
    failures.push(`Unexpected live API request: ${route.request().url()}`);
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
async function saveCustomLink(page: Page, url: string) {
  const form = page.getByRole("form", { name: "Document link" });
  await form.getByLabel("Destination").selectOption("custom");
  await form.getByLabel("Website URL").fill(url);
  await form.getByRole("button", { name: "Save link choice" }).click();
  await expect(form.getByRole("button", { name: "Save link choice" })).toBeDisabled();
}

for (const [screen, id] of [["report-wizard", "mock-report"], ["lease-wizard", "mock-lease"], ["sales-wizard", "mock-sales"]]) {
  test(`${screen}: defaults off, saves a custom destination and publishes it`, async ({ page }) => {
    await openCase(page, screen);
    const form = page.getByRole("form", { name: "Document link" });
    await expect(form.getByLabel("Destination")).toHaveValue("none");
    await form.getByLabel("Destination").selectOption("custom");
    await expect(page.getByRole("button", { name: /^Publish (report|appraisal)$/ })).toBeDisabled();
    const url = `https://example.test/${id}`;
    await saveCustomLink(page, url);
    await expect(form).toContainText("Saved for the next publication");
    await page.getByRole("button", { name: /^Publish (report|appraisal)$/ }).click();
    await expect(page.getByTestId("mock-requests")).toContainText(`PUBLISHED ${id} {"mode":"custom","url":"${url}"}`);
    await expect(page.getByTestId("mock-requests")).toContainText(`POST /api/reports/${id}/generate-pdf`);
    await expect(form).not.toContainText("Saved for the next publication");
  });
  test(`${screen}: can choose its own online report then turn QR off`, async ({ page }) => {
    await openCase(page, screen);
    const form = page.getByRole("form", { name: "Document link" });
    await form.getByLabel("Destination").selectOption("report");
    await form.getByRole("button", { name: "Save link choice" }).click();
    await expect(form).toContainText("Saved for the next publication");
    await form.getByLabel("Destination").selectOption("none");
    await form.getByRole("button", { name: "Save link choice" }).click();
    await expect(form.getByRole("button", { name: "Save link choice" })).toBeDisabled();
    await page.getByRole("button", { name: /^Publish (report|appraisal)$/ }).click();
    await expect(page.getByTestId("mock-requests")).toContainText(`PUBLISHED ${id} {"mode":"none"}`);
  });
}

test("brochure: custom URL survives publishing and can be removed on republish", async ({ page }) => {
  await openCase(page, "wizard");
  await saveCustomLink(page, "https://example.test/brochure");
  await page.getByRole("button", { name: /publish brochure/i }).click();
  await expect(page.getByTestId("mock-requests")).toContainText('PUBLISHED mock-collateral {"mode":"custom","url":"https://example.test/brochure"}');
  await expect(page.getByRole("link", { name: "Download asset" })).toBeVisible();
  const form = page.getByRole("form", { name: "Document link" });
  await form.getByLabel("Destination").selectOption("none");
  await form.getByRole("button", { name: "Save link choice" }).click();
  await page.getByRole("button", { name: /publish brochure/i }).click();
  await expect(page.getByTestId("mock-requests")).toContainText('PUBLISHED mock-collateral {"mode":"none"}');
});

test("property workspace has reports and photos without CRM or property-page controls", async ({ page }) => {
  await openCase(page, "workspace");
  await expect(page.getByRole("tab", { name: "Photos" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Leads" })).toHaveCount(0);
  await expect(page.getByText("Total views", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Property page", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Regenerate QR" })).toHaveCount(0);
  await expect(page.getByTestId("mock-requests")).not.toContainText("/api/leads");
});

test("business card has its own destination and no property picker", async ({ page }) => {
  await openCase(page, "business-card");
  await expect(page.getByLabel("Property listing", { exact: true })).toHaveCount(0);
  await saveCustomLink(page, "https://example.test/agent");
  await expect(page.getByLabel("Website URL")).toHaveValue("https://example.test/agent");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("mock-requests")).toContainText("PATCH /api/collateral/mock-card");
  await expect(page.getByLabel("Website URL")).toHaveValue("https://example.test/agent");
});

test("link editor remains usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCase(page, "report-wizard");
  await saveCustomLink(page, "https://example.test/mobile");
  await expect(page.getByRole("form", { name: "Document link" })).toBeVisible();
  await expect(page.getByLabel("Website URL")).toHaveValue("https://example.test/mobile");
});

test("invalid destinations and a failed save keep publishing blocked until a successful retry", async ({ page }) => {
  await openCase(page, "report-wizard");
  const form = page.getByRole("form", { name: "Document link" });
  await form.getByLabel("Destination").selectOption("custom");
  await form.getByLabel("Website URL").fill("javascript:alert(1)");
  await form.getByRole("button", { name: "Save link choice" }).click();
  await expect(form.getByRole("alert")).toContainText("valid http or https");
  await expect(page.getByRole("button", { name: "Publish report", exact: true })).toBeDisabled();
  await expect(page.getByTestId("mock-requests")).not.toContainText("/link");
  await page.evaluate(() => {
    const mockFetch = window.fetch;
    let failOnce = true;
    window.fetch = async (input, init) => {
      if (failOnce && String(input).endsWith("/mock-report/link")) {
        failOnce = false;
        return Response.json({ error: "Synthetic save conflict. Retry your choice." }, { status: 409 });
      }
      return mockFetch(input, init);
    };
  });
  await form.getByLabel("Website URL").fill("https://example.test/retry");
  await form.getByRole("button", { name: "Save link choice" }).click();
  await expect(form.getByRole("alert")).toContainText("Synthetic save conflict");
  await expect(page.getByRole("button", { name: "Publish report", exact: true })).toBeDisabled();
  await form.getByRole("button", { name: "Save link choice" }).click();
  await expect(form).toContainText("Saved for the next publication");
  await expect(page.getByRole("button", { name: "Publish report", exact: true })).toBeEnabled();
});
