import { expect, test } from "@playwright/test";

test("branch preview protects assets, blocks live endpoints and renders synthetic dashboard/editor", async ({ page, baseURL }) => {
  // Playwright request contexts inherit the configured HTTP credentials. Native
  // fetch deliberately sends none so this checks truly anonymous access.
  for (const path of ["/", "/dev/branch-preview", "/_next/static/example.js", "/__preview/health"]) expect((await fetch(baseURL + path, { redirect: "manual" })).status).toBe(401);
  const liveRequests: string[] = [];
  page.on("request", request => { if (/supabase\.co|staypack\.app\/api/.test(request.url())) liveRequests.push(request.url()); });
  await page.goto("/dev/branch-preview");
  await expect(page.getByRole("heading", { name: "Private branch preview", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start mock test session" }).click();
  await expect(page.getByRole("heading", { name: "Your appraisals.", exact: true })).toBeVisible();
  await page.getByLabel("Test screen", { exact: true }).selectOption("str-workspace");
  await page.getByRole("tab", { name: "Check proposal", exact: true }).click();
  await page.getByRole("button", { name: /Edit pages/ }).click();
  await expect(page.getByRole("dialog", { name: "Edit pages", exact: true })).toBeVisible();
  expect(liveRequests).toEqual([]);
  for (const path of ["/api/str/estimate", "/api/delivery/cron", "/api/billing/webhook", "/proposal/private"]) expect((await page.request.get(path)).status()).toBe(404);
});
