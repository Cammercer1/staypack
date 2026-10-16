import { randomUUID } from "node:crypto";
import { expect, test, type APIResponse } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createLintRegressionFixtures } from "../../components/dev/lintRegressionFixtures";
import { calculatorPropertyReviewKey } from "../../lib/str-calculator/propertyReviewIdentity";
import { proposalPrintUrl } from "../../lib/digital-proposals/printAccess";
import type { Client, ClientDetail, ClientListResult } from "../../lib/clients/types";
import type { ProposalWorkspace, ProposalVersionSummary } from "../../lib/digital-proposals/workspace";
import type { Listing } from "../../lib/types";

// Explicit opt-in, disposable tenant only. Provider/AI outputs are seeded fixtures;
// no estimate, property lookup, prepare, PDF generation, billing or email endpoint is called.
test("clients: calculator handoff, shared recipients and immutable published STR/lease/sales proposals", async ({ context, browser, baseURL }, testInfo) => {
  test.skip(process.env.CLIENT_SETUP_LIVE_TEST !== "1", "Requires CLIENT_SETUP_LIVE_TEST=1, migrated database and backend credentials.");
  test.setTimeout(300_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect(url && anonKey && serviceKey && baseURL, "Configure the same Supabase credentials as the preview app.").toBeTruthy();
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const agencyId = randomUUID(), widgetId = randomUUID(), leadId = randomUUID();
  let userId: string | undefined;
  const visitor = await browser.newContext({ baseURL });
  const page = await visitor.newPage();
  const unexpectedRequests: string[] = [];
  const browserErrors: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  await visitor.route(/\/api\/.*(?:estimate|generate-copy|property-profile|\/prepare|\/pdf)(?:\?|$)/, async route => {
    unexpectedRequests.push(route.request().url());
    await route.abort();
  });
  const check = <T extends { data: unknown; error: { message: string } | null }>(result: T): NonNullable<T["data"]> => {
    if (result.error) throw new Error(result.error.message);
    return result.data as NonNullable<T["data"]>;
  };
  const json = async <T,>(request: Promise<APIResponse>): Promise<T> => {
    const response = await request;
    const payload = await response.json();
    expect(response.ok(), JSON.stringify(payload)).toBeTruthy();
    return payload as T;
  };
  const headers = { Origin: baseURL! };
  const clientName = "Jordan Client QA";
  const privateEmail = `private-client-${agencyId}@example.com`;
  const privatePhone = "0412345678";
  const published: { kind: "str" | "lease" | "sales"; reportId: string; version: ProposalVersionSummary; frozen: unknown }[] = [];
  try {
    const email = `client-setup-${agencyId}@example.com`, password = `${randomUUID()}Aa1!`;
    userId = check(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user!.id;
    check(await admin.from("agencies").insert({ id: agencyId, name: "Client Setup QA", slug: `client-setup-${agencyId}`, country_code: "AU", report_template_id: "haven-properties-str" }));
    check(await admin.from("agency_members").insert({ agency_id: agencyId, user_id: userId, role: "owner" }));
    check(await admin.from("account_template_grants").insert({ agency_id: agencyId, template_id: "haven-properties-str", product: "str", is_default: true }));
    const cookies: { name: string; value: string }[] = [];
    const auth = createServerClient(url!, anonKey!, { cookies: {
      getAll: () => cookies,
      setAll: values => { cookies.splice(0, cookies.length, ...values); },
    } });
    check(await auth.auth.signInWithPassword({ email, password }));
    await context.addCookies(cookies.map(cookie => ({ ...cookie, url: baseURL! })));

    const fixture = createLintRegressionFixtures();
    const address = "2/24 QA Parade, Sydney NSW 2000";
    const fetchedAt = new Date(Date.now() - 60_000).toISOString();
    const raw = { provider: "airroi", fetched_at: fetchedAt, request_id: `synthetic-${leadId}`,
      input: { currency: "AUD", latitude: -33.8688, longitude: 151.2093, bedrooms: 3, bathrooms: 2, accommodates: 6, radiusM: 2000 },
      response: { currency: "AUD", revenue: 60000, occupancy: 0.6, average_daily_rate: 300,
        percentiles: { revenue: { p25: 40000, p50: 60000, p75: 80000, p90: 100000 },
          occupancy: { p25: 0.4, p50: 0.6, p75: 0.7, p90: 0.8 }, average_daily_rate: { p25: 200, p50: 300, p75: 400, p90: 500 } },
        monthly_revenue_distributions: Array(12).fill(1 / 12), comparable_listings: [] } };
    check(await admin.from("str_calculator_widgets").insert({ id: widgetId, agency_id: agencyId, enabled: false, country: "AU", ask_phone: true }));
    check(await admin.from("str_calculator_leads").insert({ id: leadId, agency_id: agencyId, widget_id: widgetId,
      request_id: randomUUID(), input_hash: `qa-${leadId}`, client_hash: `qa-${leadId}`,
      address, bedrooms: 3, country: "AU", email: privateEmail, phone: privatePhone, full_name: clientName,
      input_json: { address, bedrooms: 3, bathrooms: 2, full_name: clientName, email: privateEmail, phone: privatePhone, consent: true },
      original_estimate_json: raw, status: "estimated", completed_at: fetchedAt,
      estimate_json: { annualRevenue: 60000, monthlyRevenue: 5000, nightlyRate: 300, occupancyRate: 60, currency: "AUD", address, bedrooms: 3, bathrooms: 2, guests: 6 },
      consent_version: "client-setup-qa", consent_text: "Synthetic integration fixture; no person will be contacted." }));
    const leadPath = `/api/marketing/str-calculator/leads/${leadId}/report`;
    const first = await json<{ report_id: string; created: boolean; estimate_reused: boolean }>(context.request.post(leadPath, { headers }));
    expect(first.created).toBe(true);
    expect(first.estimate_reused).toBe(true);
    const repeated = await json<typeof first>(context.request.post(leadPath, { headers }));
    expect(repeated).toEqual({ ...first, created: false });
    const appraisal = check(await admin.from("str_appraisals").select("*").eq("agency_id", agencyId).eq("report_id", first.report_id).single());
    expect(appraisal).toMatchObject({ recipient_mode: "named", recipient_name: clientName, recipient_email: privateEmail,
      client_review_required: false, client_pending_json: null, client_source_lead_id: leadId });
    expect(appraisal.contact_id).toBeTruthy();
    const clients = await json<ClientListResult>(context.request.get(`/api/clients?q=${encodeURIComponent(privateEmail)}`));
    expect(clients.total).toBe(1);
    const client = clients.clients[0];
    expect(client.id).toBe(appraisal.contact_id);
    expect(client.name).toBe(clientName);
    expect((await context.request.post("/api/clients", { headers, data: { name: clientName, email: privateEmail.toUpperCase(), phone: privatePhone } })).status()).toBe(409);
    const manual = await json<{ client: Client }>(context.request.post("/api/clients", { headers, data: { name: "Manual Client QA", email: `manual-${agencyId}@example.com`, phone: "" } }));
    expect(manual.client.name).toBe("Manual Client QA");

    // Seed reviewed property/evidence only on this new report. Keep its cached estimate intact.
    const report = check(await admin.from("reports").select("*").eq("id", first.report_id).eq("agency_id", agencyId).single());
    expect(report.original_estimate_json.raw.response).toEqual(raw.response);
    expect(report.str_enrichment_json.cost_cents).toBe(0);
    const photos = fixture.listing.selected_image_urls!;
    check(await admin.from("listings").update({ hero_image_url: photos[0], selected_image_urls: photos, uploaded_image_urls: photos, property_type: "house", listing_description: "Synthetic property for client integration QA." }).eq("id", report.listing_id).eq("agency_id", agencyId));
    const listing = check(await admin.from("listings").select("*").eq("id", report.listing_id).eq("agency_id", agencyId).single()) as Listing;
    check(await admin.from("reports").update({ ai_copy_json: fixture.report.ai_copy_json,
      user_overrides_json: { ...report.user_overrides_json, calculatorReview: { status: "verified", propertyKey: calculatorPropertyReviewKey(listing) } },
      str_enrichment_json: { ...report.str_enrichment_json, comps: fixture.report.str_enrichment_json!.comps.slice(0, 6) } }).eq("id", first.report_id).eq("agency_id", agencyId));

    const reports: { kind: "str" | "lease" | "sales"; reportId: string }[] = [{ kind: "str", reportId: first.report_id }];
    for (const kind of ["lease", "sales"] as const) {
      const created = await json<{ report: { id: string } }>(context.request.post("/api/appraisals", { headers, data: {
        listing_id: listing.id, request_id: randomUUID(), kind,
        recipient: { mode: "named", contact_id: client.id, name: client.name, email: client.email ?? "", phone: client.phone ?? "" },
      } }));
      const current = check(await admin.from("str_appraisals").select("input_revision,recipient_name,contact_id").eq("report_id", created.report.id).eq("agency_id", agencyId).single());
      expect(current).toMatchObject({ recipient_name: clientName, contact_id: client.id });
      // Avoid the paid AI prepare route: seed its deterministic fixture document.
      const document = structuredClone(fixture[kind].final_report_json!);
      document.agency.name = "Client Setup QA";
      document.property.address = listing.property_address!;
      check(await admin.from("str_appraisals").update({ document_json: document, document_revision: current.input_revision }).eq("report_id", created.report.id).eq("agency_id", agencyId));
      reports.push({ kind, reportId: created.report.id });
    }

    for (const { kind, reportId } of reports) {
      const api = `/api/${kind === "str" ? "str/" : ""}appraisals/${reportId}/proposal`;
      const workspace = await json<ProposalWorkspace>(context.request.get(api));
      expect(workspace.data?.recipient).toEqual({ displayName: clientName });
      const saved = await json<{ revision: number }>(context.request.put(api, { headers, data: { revision: workspace.revision, draft: workspace.assignment!.defaults } }));
      const { version } = await json<{ version: ProposalVersionSummary }>(context.request.post(`${api}/publish`, { headers, data: { revision: saved.revision, sourceFingerprint: workspace.sourceFingerprint } }));
      const frozen = check(await admin.from("digital_proposal_versions").select("final_report_json").eq("id", version.id).eq("agency_id", agencyId).single()).final_report_json;
      expect(frozen.data.recipient).toEqual({ displayName: clientName });
      expect(frozen.pdfReport.recipient).toEqual({ displayName: clientName });
      for (const privateValue of [privateEmail, privatePhone, "+61412345678", client.id]) expect(JSON.stringify(frozen)).not.toContain(privateValue);
      published.push({ kind, reportId, version, frozen });
      await page.goto(version.path);
      await expect(page.getByText(`Prepared for ${clientName}`).first()).toBeVisible();
      expect(await page.locator("body").innerText()).not.toContain(privateEmail);
      await page.screenshot({ path: testInfo.outputPath(`${kind}-client-proposal.png`), fullPage: true });
      expect((await visitor.request.get(`/proposal/print/${version.id}`)).status()).toBe(404);
      await page.goto(proposalPrintUrl(version.id, baseURL!));
      await expect(page.locator("[data-report-recipient]")).toHaveText(`Prepared for ${clientName}`);
      expect(await page.locator("body").innerText()).not.toContain(privatePhone);
      await page.locator(".report-page").first().screenshot({ path: testInfo.outputPath(`${kind}-client-print.png`) });
    }

    const detail = await json<ClientDetail>(context.request.get(`/api/clients/${client.id}`));
    expect(detail.reportsTotal).toBe(3);
    expect(detail.leads.map(lead => lead.id)).toContain(leadId);
    const edited = await json<{ client: Client }>(context.request.patch(`/api/clients/${client.id}`, { headers, data: {
      name: "Updated Directory Name", email: privateEmail, phone: privatePhone, archived: false, expected_updated_at: detail.client.updated_at,
    } }));
    expect(edited.client.name).toBe("Updated Directory Name");
    for (const { reportId, version, frozen } of published) {
      const current = check(await admin.from("digital_proposal_versions").select("final_report_json").eq("id", version.id).eq("agency_id", agencyId).single()).final_report_json;
      expect(current).toEqual(frozen);
      const recipient = check(await admin.from("str_appraisals").select("recipient_name").eq("report_id", reportId).eq("agency_id", agencyId).single());
      expect(recipient.recipient_name).toBe(clientName);
      await page.goto(version.path);
      await expect(page.getByText(`Prepared for ${clientName}`).first()).toBeVisible();
      expect(await page.locator("body").innerText()).not.toContain("Updated Directory Name");
    }
    expect(unexpectedRequests).toEqual([]);
    expect(browserErrors).toEqual([]);
  } finally {
    // Attempt every cleanup even if a prior one fails. All IDs were generated by this test.
    const cleanupErrors: string[] = [];
    try { await visitor.close(); } catch (error) { cleanupErrors.push(`Browser cleanup: ${String(error)}`); }
    try {
      const removed = await admin.from("agencies").delete().eq("id", agencyId);
      if (removed.error) cleanupErrors.push(`Agency ${agencyId}: ${removed.error.message}`);
    } catch (error) { cleanupErrors.push(`Agency ${agencyId}: ${String(error)}`); }
    if (userId) {
      try {
        const removedUser = await admin.auth.admin.deleteUser(userId);
        if (removedUser.error) cleanupErrors.push(`User ${userId}: ${removedUser.error.message}`);
      } catch (error) { cleanupErrors.push(`User ${userId}: ${String(error)}`); }
    }
    expect(cleanupErrors, "Remove any remaining disposable records before retrying.").toEqual([]);
  }
});
