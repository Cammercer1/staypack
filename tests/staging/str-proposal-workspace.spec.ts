import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createLintRegressionFixtures } from "../../components/dev/lintRegressionFixtures";
import type { ProposalWorkspace, ProposalVersionSummary } from "../../lib/digital-proposals/workspace";
import { cleanupQaStorage } from "../../lib/testing/cleanupQaStorage";

// Development template-studio regression. Live persistence/storage checks are opt-in
// and use disposable QA records. PDF generation is stubbed; no paid provider calls.
test("digital proposals: pages, documents, frozen sharing and tenant isolation", async ({ page, context, browser, baseURL }, testInfo) => {
  test.skip(process.env.STR_LIVE_TEST !== "1", "Requires STR_LIVE_TEST=1 and configured backend credentials.");
  test.skip(!["localhost", "127.0.0.1"].includes(new URL(baseURL!).hostname), "The template studio is development-only; run this check against the local development server.");
  test.setTimeout(480_000);
  page.setDefaultTimeout(15_000);
  // A matching hosted build can serve recipient views while the development-only editor stays local.
  const publicBaseURL = process.env.STAGING_PUBLIC_BASE_URL || baseURL!;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const agencyId = randomUUID(), otherAgencyId = randomUUID(), listingId = randomUUID(), suffix = randomUUID();
  const userIds: string[] = [], accessTokens: string[] = [], storagePaths: string[] = [];
  const visitor = await browser.newContext({ baseURL: publicBaseURL });
  const otherContext = await browser.newContext({ baseURL });
  const errors: string[] = [], paidRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(/\/api\/(str\/estimate|.*generate-copy|.*property-profile)/, async route => { paidRequests.push(route.request().url()); await route.abort(); });
  await page.route(/\/proposal\/pdf$/, route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "PDF generation skipped for this browser test." }) }));
  const check = <T extends { data?: unknown; error: { message: string } | null }>(result: T): NonNullable<T["data"]> => {
    if (result.error) throw new Error(result.error.message);
    return result.data as NonNullable<T["data"]>;
  };
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
  try {
    for (const [id, target] of [[agencyId, context], [otherAgencyId, otherContext]] as const) {
      const email = `proposal-qa-${id}@example.com`, password = `${randomUUID()}Aa!1`;
      const user = check(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user!;
      userIds.push(user.id);
      check(await admin.from("agencies").insert({ id, name: "Proposal QA Agency", slug: `proposal-qa-${id}` }));
      check(await admin.from("agency_members").insert({ agency_id: id, user_id: user.id, role: "owner" }));
      const cookies: { name: string; value: string }[] = [];
      const auth = createServerClient(url, anonKey, { cookies: { getAll: () => cookies, setAll: values => { cookies.splice(0, cookies.length, ...values); } } });
      accessTokens.push(check(await auth.auth.signInWithPassword({ email, password })).session!.access_token);
      await target.addCookies(cookies.map(cookie => ({ ...cookie, url: baseURL! })));
    }
    const photos = ["marketing/staypack-rental-appraisal-front.webp", "marketing/staypack-rental-appraisal-comparables.webp", "marketing/businessman-presenting-brochure.webp", "collateral/refined-floor-plan-preview.png", "staypack-logo.png"].map(path => `https://staypack.app/${path}`);
    check(await admin.from("listings").insert({ id: listingId, public_slug: `proposal-qa-${suffix}`, agency_id: agencyId, created_by: userIds[0], property_address: "12 Proposal Test Esplanade, Byron Bay NSW 2481", suburb: "Byron Bay", state: "NSW", postcode: "2481", bedrooms: 3, bathrooms: 2, property_type: "house", selected_image_urls: photos, uploaded_image_urls: photos }));
    const created = await context.request.post("/api/str/appraisals", { data: { listing_id: listingId, request_id: randomUUID(), recipient: { mode: "named", name: "Jordan QA", email: "private-recipient@example.com", phone: "0412345678" } } });
    expect(created.ok(), await created.text()).toBeTruthy();
    const reportId = (await created.json()).report.id as string;
    const fixture = createLintRegressionFixtures().report;
    check(await admin.from("reports").update({ original_estimate_json: fixture.original_estimate_json, final_estimate_json: fixture.final_estimate_json, str_enrichment_json: fixture.str_enrichment_json, ai_copy_json: fixture.ai_copy_json, status: "estimated" }).eq("id", reportId));
    const api = `/api/str/appraisals/${reportId}/proposal`;
    const workspace = async () => {
      const response = await context.request.get(api);
      expect(response.ok(), await response.text()).toBeTruthy();
      return await response.json() as ProposalWorkspace;
    };
    // Account-owned page copy is configured by onboarding, not the appraisal editor.
    const configured = (await workspace()).assignment!;
    configured.defaults.pages.find(item => item.id === "service")!.body = "The team at {{agency.name}} is ready to help Jordan with this property.";
    check(await admin.from("digital_proposal_assignments").insert({ agency_id: agencyId, ...configured }));
    await page.goto(`/dev/str-proposal?reportId=${reportId}`);
    await expect(page.getByRole("heading", { name: "Digital template studio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "12 Proposal Test Esplanade, Byron Bay NSW 2481" })).toBeVisible();
    await page.getByLabel("Include Our management service").check();
    await page.getByRole("button", { name: "Our management service", exact: true }).click();
    await page.getByLabel("Page content", { exact: true }).fill("The team at {{agency.name}} is ready to help Jordan with this property.");
    await page.getByRole("button", { name: "Move Our management service up", exact: true }).click();
    await page.getByRole("button", { name: "Open table of contents" }).click();
    await page.getByRole("navigation", { name: "Proposal pages" }).getByRole("button", { name: "04 Our management service" }).click();
    await expect(page.getByText("The team at Proposal QA Agency is ready to help Jordan with this property.")).toBeVisible();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Page title", { exact: true }).fill("Internal omitted page");
    await page.getByLabel("Page content", { exact: true }).fill("PRIVATE_DISABLED_PAGE_MARKER");
    await page.getByLabel("Include Internal omitted page").uncheck();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Saved to your account", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Include Our management service")).toBeChecked();
    let saved = await workspace();
    expect(saved.revision).toBe(1);
    expect((await context.request.put(api, { data: { draft: saved.draft, revision: 0 } })).status()).toBe(409);
    expect((await otherContext.request.get(api)).status()).toBe(404);
    expect((await otherContext.request.put(api, { data: { draft: saved.draft, revision: 0 } })).status()).toBe(404);

    await page.getByRole("button", { name: "Documents", exact: true }).click();
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    const linkDialog = page.getByRole("dialog", { name: "Add a link", exact: true });
    await linkDialog.getByRole("button", { name: "Add link", exact: true }).click();
    await expect(linkDialog.getByRole("alert").filter({ hasText: "Enter a button label of up to 100 characters." })).toBeVisible();
    await expect(linkDialog.getByRole("alert").filter({ hasText: "Enter a full HTTPS link without a username or password." })).toBeVisible();
    expect((await workspace()).draft!.links).toEqual(saved.draft!.links);
    await linkDialog.getByLabel("Button label", { exact: true }).fill("Review & sign agreement");
    await linkDialog.getByLabel("Link URL", { exact: true }).fill("https://example.com/sign/qa-agreement");
    await linkDialog.getByLabel("Link type", { exact: true }).selectOption("sign");
    await expect(page.locator('section[aria-label="Proposal links"] ul[aria-label="Added links"]')).toHaveCount(0);
    await linkDialog.getByRole("button", { name: "Add link", exact: true }).click();
    await expect(linkDialog).not.toBeVisible();
    await expect(page.getByRole("list", { name: "Added links", exact: true }).getByText("Review & sign agreement", { exact: true })).toBeVisible();
    await page.getByLabel("Upload PDF · up to 4 MB").setInputFiles({ name: "Management agreement.pdf", mimeType: "application/pdf", buffer: pdf });
    await expect(page.getByLabel("Include Management agreement.pdf")).toBeChecked();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Saved to your account", { exact: true })).toBeVisible();
    saved = await workspace();
    expect(saved.draft!.links).toEqual([expect.objectContaining({ label: "Review & sign agreement", url: "https://example.com/sign/qa-agreement", kind: "sign" })]);
    const attachmentId = saved.attachments[0].id;
    expect((await context.request.post(`${api}/attachments`, { multipart: { file: { name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF") } } })).status()).toBe(400);
    const unused = await context.request.post(`${api}/attachments`, { multipart: { file: { name: "Internal.pdf", mimeType: "application/pdf", buffer: pdf } } });
    expect(unused.ok(), await unused.text()).toBeTruthy();
    const unusedId = (await unused.json()).attachment.id;
    const invalid = structuredClone(saved.draft!); invalid.links[0].url = "javascript:alert(1)";
    expect((await context.request.put(api, { data: { draft: invalid, revision: saved.revision } })).status()).toBe(400);
    expect((await otherContext.request.get(`${api}/attachments/${attachmentId}`)).status()).toBe(404);

    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "Edit template", exact: true }).click();
      await expect(page.getByRole("region", { name: "Proposal documents", exact: true }).getByRole("button", { name: "Choose PDF", exact: true })).toBeVisible();
      await expect(page.getByLabel("Upload PDF · up to 4 MB")).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`editor-documents-${width}.png`), fullPage: true });
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await page.getByRole("button", { name: "Open table of contents" }).click();
      await page.getByRole("navigation", { name: "Proposal pages" }).getByRole("button", { name: "06 Next steps" }).click();
      await expect(page.getByTestId("multi-page-proposal").getByRole("link", { name: /Management agreement.pdf/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.getByRole("button", { name: "Publish & share", exact: true }).click();
    const [pdfResponse] = await Promise.all([
      page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `${api}/pdf`, { timeout: 45_000 }),
      page.getByRole("button", { name: "Publish proposal", exact: true }).click(),
    ]);
    expect(pdfResponse.status()).toBe(503);
    expect(await pdfResponse.json()).toEqual({ error: "PDF generation skipped for this browser test." });
    await expect(page.getByText("PDF generation skipped for this browser test.")).toBeVisible({ timeout: 45_000 });
    saved = await workspace();
    const version = saved.versions[0];
    const publicUrl = new URL(version.path, publicBaseURL);
    const token = publicUrl.pathname.split("/").pop()!;
    const attachmentUrl = (id: string) => {
      const url = new URL(`/api/proposals/${token}/attachments/${id}`, publicBaseURL);
      url.searchParams.set("version", version.id);
      return url.href;
    };
    const published = await context.request.post(`${api}/publish`, { data: { revision: saved.revision, sourceFingerprint: saved.sourceFingerprint } });
    expect(published.ok(), await published.text()).toBeTruthy();
    expect((await published.json()).version.id).toBe(version.id);
    const publicPage = await visitor.newPage();
    publicPage.on("pageerror", error => errors.push(error.message));
    const publishedResponse = await publicPage.goto(publicUrl.href);
    expect(publishedResponse?.status()).toBe(200);
    expect(publishedResponse?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(publishedResponse?.headers()["x-robots-tag"]).toContain("noindex");
    const html = await publishedResponse!.text();
    expect(html).not.toMatch(/private-recipient@example.com|0412345678|PRIVATE_DISABLED_PAGE_MARKER/);
    await expect(publicPage.getByText("Short-term rental property appraisal Prepared for Jordan QA", { exact: true })).toBeVisible();
    for (const width of [1440, 768, 390, 320]) {
      await publicPage.setViewportSize({ width, height: 900 });
      for (const title of ["02 Rental appraisal", "03 Yearly forecast", "04 Our management service", "05 Comparable listings", "06 Next steps", "01 Your property"]) {
        await publicPage.getByRole("button", { name: "Open table of contents" }).click();
        await publicPage.getByRole("navigation", { name: "Proposal pages" }).getByRole("link", { name: title }).click();
        await publicPage.getByRole("button", { name: "Open table of contents" }).click();
        await expect(publicPage.getByRole("navigation", { name: "Proposal pages" }).getByRole("link", { name: title })).toHaveAttribute("aria-current", "page");
        await publicPage.getByRole("button", { name: "Close contents" }).click();
        expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
      await publicPage.screenshot({ path: testInfo.outputPath(`proposal-${width}.png`), fullPage: true });
    }
    await publicPage.getByRole("button", { name: "Open table of contents" }).click();
    await publicPage.getByRole("link", { name: "06 Next steps", exact: true }).click();
    await expect(publicPage.getByRole("link", { name: /Review & sign agreement/ })).toHaveAttribute("href", "https://example.com/sign/qa-agreement");
    await expect(publicPage.getByRole("link", { name: /Management agreement.pdf/ })).toBeVisible();
    const downloadUrl = attachmentUrl(attachmentId);
    const download = await visitor.request.get(downloadUrl);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-disposition"]).toContain("attachment;");
    expect(download.headers()["cache-control"]).toContain("no-store");
    expect(await download.body()).toEqual(pdf);
    expect((await visitor.request.get(attachmentUrl(unusedId))).status()).toBe(404);
    const stored = check(await admin.from("digital_proposal_attachments").select("storage_path").eq("report_id", reportId));
    storagePaths.push(...stored.map(item => item.storage_path));
    const anonymous = createClient(url, anonKey, { auth: { persistSession: false } });
    expect((await anonymous.storage.from("proposal-documents").download(storagePaths[0])).error).not.toBeNull();

    // Published text, figures and brand remain frozen through subsequent edits.
    const edited = structuredClone(saved.draft!); edited.pages.find(item => item.kind === "text")!.body = "New draft content"; edited.brandOverrides.primary = "#123456";
    const update = await context.request.put(api, { data: { draft: edited, revision: saved.revision } });
    expect(update.ok(), await update.text()).toBeTruthy();
    check(await admin.from("listings").update({ property_address: "Changed private draft address" }).eq("id", listingId));
    const refreshed = await workspace();
    expect((await context.request.post(`${api}/publish`, { data: { revision: refreshed.revision, sourceFingerprint: saved.sourceFingerprint } })).status()).toBe(409);
    const serviceUrl = new URL(publicUrl);
    serviceUrl.searchParams.set("page", "service");
    await publicPage.goto(serviceUrl.href);
    await expect(publicPage.getByText("The team at Proposal QA Agency is ready to help Jordan with this property.")).toBeVisible();
    await publicPage.getByRole("button", { name: "Open table of contents" }).click();
    await publicPage.getByRole("link", { name: "01 Your property", exact: true }).click();
    await expect(publicPage.getByRole("heading", { name: "12 Proposal Test Esplanade, Byron Bay NSW 2481" })).toBeVisible();
    const revoke = await context.request.post(`${api}/revoke`, { data: { versionId: version.id } });
    expect(revoke.ok(), await revoke.text()).toBeTruthy();
    expect((await visitor.request.get(publicUrl.href)).status()).toBe(404);
    expect((await visitor.request.get(downloadUrl)).status()).toBe(404);
    // A new publication can be made from the current saved draft, then archive
    // permanently revokes it even if the appraisal is subsequently restored.
    const second = await context.request.post(`${api}/publish`, { data: { revision: refreshed.revision, sourceFingerprint: refreshed.sourceFingerprint } });
    expect(second.ok(), await second.text()).toBeTruthy();
    const secondVersion = (await second.json()).version as ProposalVersionSummary;
    check(await admin.from("reports").update({ status: "archived" }).eq("id", reportId));
    check(await admin.from("reports").update({ status: "estimated" }).eq("id", reportId));
    expect((await visitor.request.get(new URL(secondVersion.path, publicBaseURL).href)).status()).toBe(404);
    expect(errors).toEqual([]);
    expect(paidRequests).toEqual([]);
  } finally {
    const signOuts = await Promise.allSettled(accessTokens.map(token => admin.auth.admin.signOut(token, "global")));
    if (signOuts.some(result => result.status === "rejected" || result.value.error)) throw new Error("Unable to sign out disposable QA sessions before cleanup.");
    // Gather paths even when an assertion fails before the normal download check.
    const files = check(await admin.from("digital_proposal_attachments").select("storage_path").eq("agency_id", agencyId));
    const paths = [...new Set([...storagePaths, ...files.map(item => item.storage_path)])];
    if (paths.length) check(await admin.storage.from("proposal-documents").remove(paths));
    for (const id of [agencyId, otherAgencyId]) await cleanupQaStorage(admin, id);
    for (const id of [agencyId, otherAgencyId]) check(await admin.from("agencies").delete().eq("id", id));
    for (const id of userIds) check(await admin.auth.admin.deleteUser(id));
    await visitor.close(); await otherContext.close();
  }
});
