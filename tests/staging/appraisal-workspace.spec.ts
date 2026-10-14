import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createLintRegressionFixtures } from "../../components/dev/lintRegressionFixtures";
import { mergeAppraisalResults, resolveAppraisalInput } from "../../lib/appraisals/resolveAppraisalInput";

for (const kind of ["lease", "sales"] as const) {
  test(`${kind}: navigation, isolated evidence, proposal, public mobile view and revoked links`, async ({ page, context, browser, baseURL }, testInfo) => {
    test.skip(process.env.APPRAISAL_INTEGRATION_TEST !== "1", "Disposable backend and explicit opt-in required.");
    test.setTimeout(240_000);
    page.setDefaultTimeout(15_000);
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const agencyId = randomUUID(), listingId = randomUUID();
    let userId: string | undefined;
    const visitor = await browser.newContext();
    const errors: string[] = [];
    const check = <T extends { data: unknown; error: { message: string } | null }>(result: T): NonNullable<T["data"]> => { if (result.error) throw new Error(result.error.message); return result.data as NonNullable<T["data"]>; };
    page.on("pageerror", error => errors.push(error.message));
    // PDF storage/rendering is covered separately by the full API integration test.
    await page.route(/\/proposal\/pdf$/, route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "PDF tested separately." }) }));
    try {
      const email = `appraisal-ui-${agencyId}@example.com`, password = `${randomUUID()}Aa1!`;
      userId = check(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user!.id;
      check(await admin.from("agencies").insert({ id: agencyId, name: "Coastal Appraisals", slug: `appraisal-ui-${agencyId}` }));
      check(await admin.from("agency_members").insert({ agency_id: agencyId, user_id: userId, role: "owner" }));
      const fixture = createLintRegressionFixtures();
      const photos = ["marketing/staypack-rental-appraisal-front.webp", "marketing/staypack-rental-appraisal-comparables.webp", "marketing/businessman-presenting-brochure.webp", "collateral/refined-floor-plan-preview.png", "staypack-logo.png"].map(path => `${baseURL}/${path}`);
      const listing = { ...fixture.listing, id: listingId, agency_id: agencyId, created_by: userId, agent_profile_id: null, public_slug: `appraisal-${listingId}`, landing_template: "minimal", hero_image_url: photos[0], selected_image_urls: photos, uploaded_image_urls: photos };
      const parsed = resolveAppraisalInput(fixture.listing);
      parsed.rentalComps = parsed.rentalComps?.map(comp => ({ ...comp, imageUrl: photos[0] }));
      parsed.salesComps = parsed.salesComps?.map((comp, index) => ({ ...comp, imageUrl: photos[0], saleStatus: index === 1 ? "for_sale" : "sold" }));
      listing.scraped_listing_json = mergeAppraisalResults(listing, "lease", parsed);
      listing.scraped_listing_json = mergeAppraisalResults(listing, "sales", parsed);
      check(await admin.from("listings").insert(listing));
      const cookies: { name: string; value: string }[] = [];
      const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => cookies, setAll: values => { cookies.splice(0, cookies.length, ...values); } } });
      check(await auth.auth.signInWithPassword({ email, password }));
      await context.addCookies(cookies.map(cookie => ({ ...cookie, url: baseURL! })));
      await page.goto("/appraisals");
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      for (const name of ["All appraisals", "Short-Term Rentals", "Rental appraisals", "Sales appraisals"]) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
      await nav.getByRole("link", { name: kind === "lease" ? "Rental appraisals" : "Sales appraisals" }).click();
      await expect(page.getByRole("heading", { name: kind === "lease" ? "Rental appraisals" : "Sales appraisals", exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Create appraisal", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/appraisals/new\\?kind=${kind}`));
      await page.getByRole("button", { name: new RegExp(listing.property_address!) }).click();
      await page.getByRole("button", { name: "Create appraisal", exact: true }).click();
      await expect(page).toHaveURL(/\/appraisals\/[a-f0-9-]{36}$/);
      const reportId = page.url().split("/").pop()!;
      await page.getByRole("combobox", { name: /Cover photograph/ }).selectOption({ label: "Photo 2" });
      const selectedPhoto = await page.getByRole("combobox", { name: /Cover photograph/ }).inputValue();
      // Step navigation must save property edits just like the Continue button.
      await page.getByRole("button", { name: "2. Review evidence", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Review appraisal evidence" })).toBeVisible();
      expect(check(await admin.from("appraisals").select("inputs_json").eq("report_id", reportId).single()).inputs_json.listing.hero_image_url).toBe(selectedPhoto);
      if (kind === "lease") {
        await page.getByLabel("Weekly min ($)", { exact: true }).fill("1400");
        await page.getByLabel("Weekly max ($)", { exact: true }).fill("1600");
        await page.getByLabel("Weekly midpoint ($)", { exact: true }).fill("1500");
      } else {
        await page.getByLabel("Price min ($)", { exact: true }).fill("2800000");
        await page.getByLabel("Price max ($)", { exact: true }).fill("3200000");
        await page.getByLabel("Price midpoint ($)", { exact: true }).fill("3000000");
      }
      await page.getByRole("button", { name: "1. Property", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "save your evidence changes" })).toContainText("save your evidence changes");
      await page.getByRole("button", { name: "Continue to proposal", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Your proposal", exact: true })).toBeVisible({ timeout: 45_000 });
      await page.getByLabel("Heading", { exact: true }).fill(`Your ${kind === "lease" ? "rental" : "sales"} proposal`);
      await page.getByRole("button", { name: "Continue to customer & share", exact: true }).click();
      await page.getByRole("button", { name: "Add customer", exact: true }).click();
      await page.getByLabel("Customer name", { exact: true }).fill("Jordan Coastal");
      await page.getByRole("button", { name: "Save customer details", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Prepared for Jordan Coastal", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Publish proposal", exact: true }).click();
      await expect(page.getByText("PDF tested separately.", { exact: true })).toBeVisible();
      const response = await context.request.get(`/api/appraisals/${reportId}/proposal`);
      expect(response.status()).toBe(200);
      const workspace = await response.json();
      expect(workspace.data.appraisal.kind).toBe(kind);
      expect(workspace.draft.content.title).toContain("proposal");
      expect(check(await admin.from("listings").select("listing_description,appraisal_overrides_json").eq("id", listingId).single()).listing_description).toBe(fixture.listing.listing_description);
      const publicPage = await visitor.newPage();
      publicPage.on("pageerror", error => errors.push(error.message));
      await publicPage.goto(`${baseURL}${workspace.versions[0].path}?page=appraisal`);
      await expect(publicPage.getByText(kind === "lease" ? "Estimated weekly rental range" : "Estimated selling range", { exact: true })).toBeVisible();
      await publicPage.screenshot({ path: testInfo.outputPath(`${kind}-proposal-desktop.png`), fullPage: true, animations: "disabled" });
      await publicPage.setViewportSize({ width: 390, height: 844 });
      await expect(publicPage.getByTestId("multi-page-proposal")).toBeVisible();
      expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await publicPage.screenshot({ path: testInfo.outputPath(`${kind}-proposal-mobile.png`), fullPage: true, animations: "disabled" });
      await publicPage.goto(`${baseURL}${workspace.versions[0].path}?page=evidence`);
      await expect(publicPage.getByText(kind === "lease" ? "Rental listing" : "For sale · asking price", { exact: true }).first()).toBeVisible();
      await publicPage.screenshot({ path: testInfo.outputPath(`${kind}-evidence-mobile.png`), fullPage: true, animations: "disabled" });
      await page.getByRole("button", { name: "Revoke link", exact: true }).click();
      await expect(page.getByText("Share link revoked.", { exact: true })).toBeVisible();
      expect((await publicPage.reload())?.status()).toBe(404);
      await page.goto(`/listings/${listingId}`);
      await expect(page.getByRole("heading", { name: "Your collateral", exact: true })).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      const mobileNav = page.getByRole("dialog", { name: "Workspace navigation" });
      for (const name of ["Short-Term Rentals", "Rental appraisals", "Sales appraisals"]) await expect(mobileNav.getByRole("link", { name, exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${kind}-mobile-navigation.png`), animations: "disabled" });
      expect(errors).toEqual([]);
    } finally {
      await visitor.close();
      check(await admin.from("agencies").delete().eq("id", agencyId));
      if (userId) check(await admin.auth.admin.deleteUser(userId));
    }
  });
}
