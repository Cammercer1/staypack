import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createLintRegressionFixtures } from "../../components/dev/lintRegressionFixtures";

// Runs against the actual release with a disposable tenant. Provider output is
// seeded; estimates, copy, PDF generation and customer messages are never sent.
test("release: desktop/mobile STR navigation, appraisal, saved proposal and public sharing", async ({ page, context, browser, baseURL }, testInfo) => {
  test.skip(process.env.STR_LIVE_TEST !== "1", "Requires explicit live integration opt-in and backend credentials.");
  test.setTimeout(240_000);
  page.setDefaultTimeout(15_000);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const agencyId = randomUUID(), listingId = randomUUID();
  const address = "12 Release QA Esplanade, Byron Bay NSW 2481";
  let userId: string | undefined;
  let accessToken: string | undefined;
  const visitor = await browser.newContext();
  const errors: string[] = [], paidRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(/\/api\/(str\/estimate|.*generate-copy)/, async route => { paidRequests.push(route.request().url()); await route.abort(); });
  await page.route(/\/proposal\/pdf$/, route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "PDF generation skipped by release verification." }) }));
  const check = <T extends { data: unknown; error: { message: string } | null }>(result: T): NonNullable<T["data"]> => {
    if (result.error) throw new Error(result.error.message);
    return result.data as NonNullable<T["data"]>;
  };
  try {
    const email = `str-release-${agencyId}@example.com`, password = `${randomUUID()}Aa1!`;
    userId = check(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user!.id;
    check(await admin.from("agencies").insert({ id: agencyId, name: "STR Release QA", slug: `str-release-${agencyId}` }));
    check(await admin.from("agency_members").insert({ agency_id: agencyId, user_id: userId, role: "owner" }));
    const photos = ["marketing/staypack-rental-appraisal-front.webp", "marketing/staypack-rental-appraisal-comparables.webp", "marketing/businessman-presenting-brochure.webp", "collateral/refined-floor-plan-preview.png", "staypack-logo.png"].map(path => `${baseURL}/${path}`);
    check(await admin.from("listings").insert({ id: listingId, public_slug: `str-release-${listingId}`, agency_id: agencyId, created_by: userId, property_address: address, suburb: "Byron Bay", state: "NSW", postcode: "2481", latitude: -28.6434, longitude: 153.6122, bedrooms: 3, bathrooms: 2, property_type: "house", hero_image_url: photos[0], selected_image_urls: photos, uploaded_image_urls: photos, scraped_listing_json: { propertyLookup: { source: "domain", matchedAt: new Date().toISOString(), advertisedSalePrice: null, media: [] } } }));
    const cookies: { name: string; value: string }[] = [];
    const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => cookies, setAll: values => { cookies.splice(0, cookies.length, ...values); } } });
    accessToken = check(await auth.auth.signInWithPassword({ email, password })).session!.access_token;
    await context.addCookies(cookies.map(cookie => ({ ...cookie, url: baseURL! })));

    await page.goto("/listings");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Short-Term Rentals" }).click();
    await expect(page.getByRole("heading", { name: "Short-Term Rentals", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Short-Term Rentals" })).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: testInfo.outputPath("str-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation" }).click();
    const mobileNav = page.getByRole("dialog", { name: "Workspace navigation" });
    await expect(mobileNav.getByRole("link", { name: "Short-Term Rentals" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("str-mobile-navigation.png"), animations: "disabled" });
    await mobileNav.getByRole("link", { name: "Short-Term Rentals" }).click();
    await expect(mobileNav).not.toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.getByRole("link", { name: "Create appraisal", exact: true }).first().click();
    await page.getByRole("button", { name: new RegExp(address) }).click();
    const propertyProfile = page.waitForResponse(response => response.url().endsWith(`/api/listings/${listingId}/property-profile`));
    await page.getByRole("button", { name: "Create appraisal", exact: true }).click();
    await expect(page).toHaveURL(/\/short-term-rentals\/appraisals\/[a-f0-9-]{36}$/, { timeout: 45_000 });
    const reportId = page.url().split("/").pop()!;
    await expect(page.getByRole("tab", { name: "Property", exact: true })).toHaveAttribute("aria-selected", "true");
    expect((await (await propertyProfile).json()).cached).toBe(true);
    const fixture = createLintRegressionFixtures().report;
    check(await admin.from("reports").update({ original_estimate_json: fixture.original_estimate_json, final_estimate_json: fixture.final_estimate_json, str_enrichment_json: fixture.str_enrichment_json, ai_copy_json: fixture.ai_copy_json, status: "estimated", user_overrides_json: { estimateInputs: { bedrooms: 3, bathrooms: 2, accommodates: 6 } } }).eq("id", reportId));
    await page.reload();
    await expect(page.getByRole("tab", { name: "Rental appraisal", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Fine-tune assumptions", exact: true }).click();
    const assumptions = page.getByRole("dialog", { name: "Fine-tune assumptions" });
    await assumptions.getByLabel("Average daily rate · ADR ($)", { exact: true }).fill("400");
    await assumptions.getByLabel("Estimated occupancy (%)", { exact: true }).fill("75");
    await assumptions.getByRole("button", { name: "Apply changes", exact: true }).click();
    await page.getByRole("button", { name: "Continue to proposal", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your proposal", exact: true })).toBeVisible();
    expect(check(await admin.from("reports").select("final_estimate_json").eq("id", reportId).single()).final_estimate_json.annualRevenue).toBe(109500);
    await page.getByRole("checkbox", { name: "Include Yearly forecast", exact: true }).uncheck();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Continue to customer & share", exact: true }).click();
    await page.getByRole("button", { name: "Add contact", exact: true }).click();
    const contactDialog = page.getByRole("dialog", { name: "Add contact", exact: true });
    await contactDialog.getByRole("button", { name: "Add new contact", exact: true }).click();
    await contactDialog.getByLabel("Contact name", { exact: true }).fill("Jordan Release QA");
    await contactDialog.getByRole("button", { name: "Save contact details", exact: true }).click();
    await expect(page.getByRole("region", { name: "Contact · Prepared for", exact: true }).getByText("Jordan Release QA", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Publish proposal", exact: true }).click();
    await expect(page.getByText("PDF generation skipped by release verification.", { exact: true })).toBeVisible({ timeout: 45_000 });
    const response = await context.request.get(`/api/str/appraisals/${reportId}/proposal`);
    expect(response.status()).toBe(200);
    const workspace = await response.json();
    expect(workspace.draft.pages.find((item: { id: string }) => item.id === "forecast").enabled).toBe(false);
    const publicPage = await visitor.newPage();
    publicPage.on("pageerror", error => errors.push(error.message));
    expect((await publicPage.goto(`${baseURL}${workspace.versions[0].path}`))?.status()).toBe(200);
    await expect(publicPage.getByTestId("multi-page-proposal")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("appraisal-published.png"), fullPage: true });
    await page.goto(`/listings/${listingId}/reports/${reportId}`);
    await expect(page).toHaveURL(new RegExp(`/short-term-rentals/appraisals/${reportId}$`));
    await page.goto("/short-term-rentals");
    await expect(page.getByText("Prepared for Jordan Release QA", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(paidRequests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await visitor.close();
    if (accessToken) check(await admin.auth.admin.signOut(accessToken, "global"));
    check(await admin.from("agencies").delete().eq("id", agencyId));
    if (userId) check(await admin.auth.admin.deleteUser(userId));
  }
});
