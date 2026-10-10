import { initialStrManagementScenario, applyStrEstimateAdjustments, reconcileStrEstimate, readStrRateOverride, saveStrRateOverride, strAdjustmentSchema, strManagementPresetsSchema } from "@/lib/reports/strEstimateAdjustments";
import { selectStrComps } from "@/lib/str/comparables";
import { buildFinalReportJson, getMockAiCopy } from "@/lib/reports/buildFinalReportJson";
import { finalReportCopyToAiCopy } from "@/lib/reports/editable/strReportCopyAdapter";
import { getTemplatesForProduct } from "@/lib/templates/catalog";
import { serializeTemplateForApi } from "@/lib/templates/serializeForApi";
import type { TemplateProduct } from "@/lib/templates/types";
import { mergeAppraisalResults, resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";
import { buildLeaseAppraisalTemplatePreview } from "@/lib/lease-appraisal/templatePreviewDocument";
import { buildSalesAppraisalTemplatePreview } from "@/lib/sales-appraisal/templatePreviewDocument";
import { createEmptyReportDraft } from "@/lib/reports/emptyReportDraft";
import { getStrPlaygroundReport } from "@/lib/reports/strPlayground";
import { applyDocumentLinkDraft, documentLinkSchema } from "@/lib/documents/documentLink";
import { generateQrCodeDataUrl } from "@/lib/reports/qr";
import { buildBusinessCardDocument } from "@/lib/collateral/buildBusinessCardDocument";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import type { Agency, AgentProfile, CollateralItem, LeadWithListing, Listing, Report } from "@/lib/types";

/** Synthetic records only. Never load an account or listing in this playground. */
export function createLintRegressionFixtures() {
  const document = structuredClone(createPlaygroundSalesBrochureDocument());
  const timestamp = "2026-10-08T00:00:00.000Z";
  const agency: Agency = {
    ...document.agency, id: "mock-agency", slug: "mock-agency", slug_aliases: [],
    logo_light_url: document.agency.logo_light_url ?? null,
    logo_dark_url: document.agency.logo_dark_url ?? null,
    callout_heading_colour: null, callout_text_colour: null,
    heading_font_file_url: null, body_font_file_url: null, font_file_url: null,
    default_report_title: "Mock report", default_cta: "Contact the mock agency",
    default_disclaimer: document.copy.disclaimer, report_template_id: "classic_detailed",
    collateral_template_defaults: {}, brand_advanced_json: null, created_at: timestamp, updated_at: timestamp,
    str_management_presets: [{ id: "ea8eedcf-4618-4be4-9d34-a8d4f0c07f17", name: "Manly · established family homes", nightlyRate: 440, occupancyRate: 72, assumptions: { unavailableNights: 21, listingStage: "established", rationale: "Assumes professional photography, family-ready furnishings and active pricing. Owner use is limited to 21 nights." } }, { id: "da8eedcf-4618-4be4-9d34-a8d4f0c07f18", name: "Company defaults", mode: "relative", isDefault: true, adrPercent: 10, occupancyPoints: 5, assumptions: { unavailableNights: 21, listingStage: "established", rationale: "Assumes professional presentation and active pricing, with owner use limited to 21 nights." } }],
  };
  const agent: AgentProfile = {
    ...document.agent, id: "mock-agent", agency_id: agency.id, is_default: true,
    email: "harvey@example.test", phone: "0400000000", created_at: timestamp, updated_at: timestamp,
  };
  const listing: Listing = {
    id: "mock-listing", agency_id: agency.id, created_by: null, agent_profile_id: agent.id,
    status: "active", listing_purpose: "sale", listing_url: "https://example.test/property",
    property_address: document.property.address, suburb: "Manly", state: "NSW", postcode: "2095", country: "AU",
    latitude: null, longitude: null, property_type: "house", bedrooms: 4, bathrooms: 2, car_spaces: 2, accommodates: 8,
    listing_title: "Mock coastal home", listing_description: document.copy.blurb,
    display_price: "$2,450,000", bond: null, hero_image_url: document.property.hero_image_url,
    selected_image_urls: document.property.selected_image_urls, uploaded_image_urls: [],
    collateral_image_selections: {}, listing_image_meta: {},
    scraped_listing_json: { confidence: "high", warnings: [], images: document.property.selected_image_urls, agents: [{ ...document.agent, email: "harvey@example.test", phone: "0400000000" }] },
    public_slug: "mock", public_url: null, custom_landing_url: null, landing_qr_code_url: null,
    landing_published_at: timestamp, landing_template: null, created_at: timestamp, updated_at: timestamp,
  };
  const comps = Array.from({ length: 8 }, (_, index) => ({
    address: `${20 + index} Coast Street`, suburb: "Manly", propertyType: "house", bedrooms: 4, bathrooms: 2,
    listingUrl: `https://example.test/comparable/${index}`, weeklyRent: 1200 + index * 25,
    price: 2400000 + index * 25000, saleStatus: "sold" as const, soldDate: new Date(Date.now() - 86400000).toISOString(), imageUrl: document.property.hero_image_url,
  }));
  const selectedCompListingIds = comps.slice(0, 6).map((comp) => comp.listingUrl);
  listing.scraped_listing_json = mergeAppraisalResults(listing, "lease", { ...resolveAppraisalInput(listing), rentalComps: comps, rentalAppraisal: {weeklyMin: 1200, weeklyMax: 1400, weeklyMidpoint: 1300, compCount: 8, selectedCompListingIds} });
  listing.scraped_listing_json = mergeAppraisalResults(listing, "sales", { ...resolveAppraisalInput(listing), salesComps: comps, salesAppraisal: {priceMin: 2400000, priceMax: 2600000, priceMidpoint: 2500000, compCount: 8, selectedCompListingIds} });
  const collateral: CollateralItem = {
    id: "mock-collateral", listing_id: listing.id, agency_id: agency.id, type: "sales_brochure", status: "generated",
    report_id: null, template_id: document.template_id, document_json: document,
    public_slug: null, public_url: null, pdf_url: null, qr_code_url: null, generated_at: timestamp, published_at: null,
    created_at: timestamp, updated_at: timestamp,
  };
  const lead: LeadWithListing = {
    id: "mock-lead", listing_id: listing.id, agency_id: agency.id, name: "Mock Buyer", email: "buyer@example.test",
    phone: null, status: "new", source: "landing_page", created_at: timestamp, updated_at: timestamp,
    listings: { id: listing.id, listing_title: listing.listing_title, property_address: listing.property_address, public_slug: "mock", status: "active" },
  };
  document.document_link = { mode: "none" };
  document.assets.qr_code_url = "";
  const final = { ...getStrPlaygroundReport(), document_link: { mode: "none" as const } };
  const report = createEmptyReportDraft({ id: "mock-report", agency_id: agency.id, listing_id: listing.id, status: "generated", template_id: final.template_id ?? null, final_report_json: final });
  report.final_estimate_json = { annualRevenue: final.str.annual_revenue, monthlyRevenue: final.str.monthly_revenue, weeklyRevenue: final.str.weekly_revenue, nightlyRate: final.str.nightly_rate, occupancyRate: (final.str.occupancy_rate ?? 0) <= 1 ? (final.str.occupancy_rate ?? 0) * 100 : final.str.occupancy_rate, bookedNights: final.str.booked_nights, radiusM: final.str.radius_m, raw: {} };
  report.original_estimate_json = structuredClone(report.final_estimate_json);
  report.ai_copy_json = finalReportCopyToAiCopy(final.copy, null);
  report.str_enrichment_json = final.str_enrichment ? { ...final.str_enrichment, comps: Array.from({ length: 8 }, (_, i) => ({ listing_id: `str-comp-${i}`, name: `Coastal stay ${i + 1}`, thumbnail_url: document.property.hero_image_url, listing_url: "https://example.test/property", bedrooms: i % 2 ? 3 : 4, bathrooms: 2, accommodates: i % 2 ? 6 : 8, distance_m: (i + 1) * 200, annual_revenue: 85000 + i * 3000, occupancy_rate: 68 + i, nightly_rate: 340 + i * 10 })) } : null;
  report.airbtics_fetched_at = timestamp;
  if (report.str_enrichment_json) report.str_enrichment_json.comps = report.str_enrichment_json.comps.map((comp, index) => ({ ...comp, property_type: "house", professional_management: index === 6 ? null : index % 2 === 0, reviews: 12 + index * 5, rating: 4.7 + (index % 3) / 10, blocked_nights: index * 12 }));
  const lease: Report = { ...report, id: "mock-lease", template_id: "classic-lease-appraisal", final_report_json: { ...final, version: "lease_appraisal_v1", template_id: "classic-lease-appraisal" } };
  const sales: Report = { ...report, id: "mock-sales", template_id: "classic-sales-appraisal", final_report_json: { ...final, version: "sales_appraisal_v1", template_id: "classic-sales-appraisal" } };
  lease.final_report_json = buildLeaseAppraisalTemplatePreview({ agency, listing, report: lease, templateId: lease.template_id!, agencyAgents: [agent] });
  sales.final_report_json = buildSalesAppraisalTemplatePreview({ agency, listing, report: sales, templateId: sales.template_id!, agencyAgents: [agent] });
  const card: CollateralItem = { ...collateral, id: "mock-card", type: "agent_business_card", listing_id: null, document_json: buildBusinessCardDocument({ agency, agentProfile: agent, listing: null, collateral: { ...collateral, type: "agent_business_card", template_id: null } }) };
  const leaseCollateral: CollateralItem = { ...collateral, type: "lease_appraisal", report_id: lease.id };
  const salesCollateral: CollateralItem = { ...collateral, type: "sales_appraisal", report_id: sales.id };
  return { document, agency, agent, listing, collateral, lead, report, lease, sales, card, leaseCollateral, salesCollateral };
}

export type RegressionFixtures = ReturnType<typeof createLintRegressionFixtures>;

/** Intercepts every app API request before the real components mount. No fall-through for APIs. */
export function installRegressionMocks(fixtures: RegressionFixtures, onRequest: (label: string) => void, draftAppraisal?: "lease" | "sales" | "sales_brochure" | "rental_brochure" | "str") {
  const original = window.fetch;
  const data = structuredClone(fixtures);
  if (draftAppraisal === "str") data.report = { ...data.report, template_id: null, original_estimate_json: null, user_overrides_json: null, final_estimate_json: null, ai_copy_json: null, final_report_json: null, str_enrichment_json: null, status: "draft" };
  if (draftAppraisal === "lease" || draftAppraisal === "sales") data[draftAppraisal] = { ...data[draftAppraisal], template_id: null, final_report_json: null, status: "draft" };
  if (draftAppraisal === "sales_brochure" || draftAppraisal === "rental_brochure") {
    data.document = draftAppraisal === "rental_brochure" ? { ...data.document, type: "rental_brochure", version: "rental_brochure_v1", template_id: data.document.template_id.replace(/^sales-brochure-/, "rental-brochure-") } : data.document;
    data.collateral = { ...data.collateral, type: draftAppraisal, template_id: null, document_json: null, pdf_url: null, status: "draft" };
  }
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (!url.pathname.startsWith("/api/")) return original(input, init);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const label = `${method} ${url.pathname}`;
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    // The delay exercises loading indicators and cancellation without network access.
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    onRequest(label);
    if (url.pathname === "/api/templates") {
      const templates = getTemplatesForProduct(url.searchParams.get("product") as TemplateProduct).filter((entry) => entry.scope === "platform").map(serializeTemplateForApi);
      return Response.json({ templates, default_template_id: templates[0]?.id });
    }
    if (url.pathname === "/api/str/estimate" || url.pathname === "/api/airbtics/estimate") {
      data.listing = { ...data.listing, bedrooms: body.bedrooms, bathrooms: body.bathrooms, accommodates: body.accommodates };
      const initialScenario = !data.report.original_estimate_json && !data.report.final_estimate_json && !data.report.final_report_json && !readStrRateOverride(data.report) ? initialStrManagementScenario(fixtures.report.original_estimate_json!, data.agency.str_management_presets) : null;
      const rates = readStrRateOverride(data.report) ?? initialScenario?.rates ?? null;
      data.report = { ...data.report, original_estimate_json: fixtures.report.original_estimate_json, final_estimate_json: rates ? applyStrEstimateAdjustments(fixtures.report.original_estimate_json!, rates) : fixtures.report.final_estimate_json, str_enrichment_json: fixtures.report.str_enrichment_json, user_overrides_json: { ...saveStrRateOverride(data.report.user_overrides_json, rates, initialScenario?.assumptions ?? data.report.user_overrides_json?.strManagement), estimateInputs: { bedrooms: body.bedrooms, bathrooms: body.bathrooms, accommodates: body.accommodates } }, airbtics_fetched_at: new Date().toISOString(), status: "estimated", pdf_url: null };
      return Response.json({ report: data.report, listing: data.listing });
    }
    if (/^\/api\/reports\/mock-report(?:\/(generate-copy|str-report-copy))?$/.test(url.pathname)) {
      if (method === "GET") return Response.json({ report: data.report, listing: data.listing });
      const generation = url.pathname.endsWith("generate-copy");
      const report = { ...data.report, ...(!generation && !body.copy ? body : {}), template_id: body.template_id ?? data.report.template_id, pdf_url: null, updated_at: new Date().toISOString() };
      if (body.str_adjustment && report.original_estimate_json) {
        const adjustment = strAdjustmentSchema.parse(body.str_adjustment);
        const rates = adjustment.mode !== "baseline" ? { nightlyRate: adjustment.nightlyRate, occupancyRate: adjustment.occupancyRate } : null;
        report.final_estimate_json = rates ? applyStrEstimateAdjustments(report.original_estimate_json, rates) : reconcileStrEstimate(report.original_estimate_json);
        report.user_overrides_json = saveStrRateOverride(report.user_overrides_json, rates, adjustment.mode === "management" ? adjustment.assumptions : null);
      }
      if (body.selected_comp_listing_ids && report.str_enrichment_json) report.str_enrichment_json = selectStrComps(report.str_enrichment_json, body.selected_comp_listing_ids);
      report.ai_copy_json = body.copy ? finalReportCopyToAiCopy(body.copy, report.ai_copy_json) : generation ? getMockAiCopy(data.listing, data.agency) : report.ai_copy_json;
      if (report.ai_copy_json && report.final_estimate_json) report.final_report_json = buildFinalReportJson({ agency: data.agency, agencyAgents: [data.agent], listing: data.listing, report, estimate: report.final_estimate_json, copy: report.ai_copy_json, propertyImages: body.property_images ?? (report.final_report_json ? { hero_image_url: report.final_report_json.property.hero_image_url, selected_image_urls: report.final_report_json.property.selected_image_urls } : null) });
      data.report = report;
      return Response.json({ report, listing: data.listing });
    }
    const appraisalMatch = url.pathname.match(/^\/api\/reports\/mock-(lease|sales)(?:\/(generate-(?:lease|sales)-appraisal|(?:lease|sales)-appraisal-copy))?$/);
    if (appraisalMatch) {
      const key = appraisalMatch[1] as "lease" | "sales";
      const report = data[key];
      const templateId = body.template_id ?? report.template_id;
      const final = appraisalMatch[2]?.startsWith("generate")
        ? (key === "lease" ? buildLeaseAppraisalTemplatePreview : buildSalesAppraisalTemplatePreview)({ agency: data.agency, listing: data.listing, report, templateId, agencyAgents: [data.agent] })
        : report.final_report_json;
      data[key] = { ...report, template_id: templateId, final_report_json: final ? { ...final, template_id: templateId, copy: body.copy ?? final.copy } : null, pdf_url: null };
      return Response.json({ report: data[key], listing: data.listing });
    }
    const dataMatch = url.pathname.match(/^\/api\/listings\/mock-listing\/(lease|sales)-appraisal\/data$/);
    if (dataMatch) {
      const kind = dataMatch[1] as "lease" | "sales";
      const parsed = resolveAppraisalInput(data.listing);
      data.listing.scraped_listing_json = mergeAppraisalResults(data.listing, kind, { ...parsed,
        ...(kind === "lease" ? { rentalAppraisal: { ...parsed.rentalAppraisal, selectedCompListingIds: body.selected_comp_listing_ids, weeklyMin: body.weekly_min ?? parsed.rentalAppraisal?.weeklyMin, weeklyMax: body.weekly_max ?? parsed.rentalAppraisal?.weeklyMax } } : { salesAppraisal: { ...parsed.salesAppraisal, selectedCompListingIds: body.selected_comp_listing_ids } }),
      });
      return Response.json({ listing: data.listing });
    }
    const reportMatch = url.pathname.match(/^\/api\/reports\/(mock-report|mock-lease|mock-sales)\/(link|publish|generate-pdf)$/);
    if (reportMatch) {
      const key = reportMatch[1] === "mock-report" ? "report" : reportMatch[1] === "mock-lease" ? "lease" : "sales";
      let report = data[key];
      const action = reportMatch[2];
      if (action === "link") {
        const link = documentLinkSchema.parse(body);
        const target = link.mode === "custom" ? link.url : link.mode === "report" ? `https://example.test/reports/${report.id}` : "";
        report = { ...report, final_report_json: { ...report.final_report_json!, document_link_draft: { link, target_url: target, qr_code_url: target ? await generateQrCodeDataUrl(target) : "" } } };
      } else if (action === "publish") {
        report = { ...report, status: "published", public_url: `https://example.test/reports/${report.id}`, final_report_json: applyDocumentLinkDraft(report.final_report_json!) };
        onRequest(`PUBLISHED ${report.id} ${JSON.stringify(report.final_report_json!.document_link)}`);
      } else {
        report = { ...report, pdf_url: "https://example.test/mock.pdf" };
      }
      data[key] = report;
      return Response.json({ report, pdf_url: report.pdf_url, public_url: report.public_url });
    }
    if (url.pathname === "/api/collateral/mock-collateral/generate-copy") {
      data.document = { ...data.document, copy: { ...data.document.copy, price_value: body.price_value ?? data.document.copy.price_value }, template_id: data.collateral.template_id ?? data.document.template_id, content_saved_at: new Date().toISOString() };
      data.collateral = { ...data.collateral, document_json: data.document, pdf_url: null, status: "generated" };
      return Response.json({ collateral: data.collateral, copy: data.document.copy });
    }
    const collateralMatch = url.pathname.match(/^\/api\/collateral\/(mock-collateral|mock-card)\/(link|publish|generate-pdf)$/);
    if (collateralMatch) {
      const key = collateralMatch[1] === "mock-card" ? "card" : "collateral";
      let item = data[key];
      const action = collateralMatch[2];
      const doc = item.document_json! as typeof data.document;
      if (action === "link") {
        const link = documentLinkSchema.parse(body);
        const target = link.mode === "custom" ? link.url : "";
        const pending = { ...doc, content_saved_at: new Date().toISOString(), document_link_draft: { link, target_url: target, qr_code_url: target ? await generateQrCodeDataUrl(target) : "" } };
        item = { ...item, document_json: key === "card" ? applyDocumentLinkDraft(pending) : pending };
      } else if (action === "publish") {
        item = { ...item, status: "published", public_url: "https://example.test/brochure", document_json: applyDocumentLinkDraft(doc) };
        onRequest(`PUBLISHED ${item.id} ${JSON.stringify((item.document_json as typeof data.document).document_link)}`);
      } else {
        item = { ...item, pdf_url: "https://example.test/mock.pdf", document_json: { ...doc, pdf_synced_at: doc.content_saved_at } };
      }
      data[key] = item;
      if (key === "collateral") data.document = item.document_json as typeof data.document;
      return Response.json({ collateral: item, pdf_url: item.pdf_url });
    }
    if (url.pathname === "/api/collateral/mock-card") {
      data.card = { ...data.card, document_json: { ...data.card.document_json!, ...body } };
      return Response.json({ collateral: data.card });
    }
    if (/^\/api\/listings\/mock-listing\/(lease|sales)-appraisal\/enrich$/.test(url.pathname)) return Response.json({ listing: data.listing });
    if (url.pathname === "/api/agents") {
      return Response.json(method === "GET" ? { agents: [data.agent] } : { agent: { ...data.agent, ...body } });
    }
    if (url.pathname === "/api/analytics/overview") return Response.json({ views: 240, leads: 12 });
    if (url.pathname === "/api/google-fonts") return Response.json({ fonts: [{ family: "Mock Sans", category: "sans-serif" }] });
    if (url.pathname === "/api/agencies/str-presets") {
      data.agency.str_management_presets = strManagementPresetsSchema.parse(method === "POST" ? [...(data.agency.str_management_presets ?? []), {
        id: "ba8eedcf-4618-4be4-9d34-a8d4f0c07f18", name: "Company management uplift", mode: "uplift", isDefault: true, upliftPercent: body.upliftPercent, assumptions: body.assumptions,
      }] : body.presets);
      return Response.json({ presets: data.agency.str_management_presets });
    }
    if (url.pathname === "/api/agencies") {
      data.agency = { ...data.agency, ...body };
      return Response.json({ agency: data.agency, can_manage_str_defaults: true });
    }
    if (url.pathname === "/api/listings/mock-listing") {
      data.listing = { ...data.listing, ...body, updated_at: new Date().toISOString(),
        scraped_listing_json: { ...data.listing.scraped_listing_json!, ...(body.listing_agents ? { agents: body.listing_agents } : {}) } };
      return Response.json({ listing: data.listing });
    }
    if (url.pathname === "/api/collateral/preview-brand") return Response.json({ agency: data.document.agency, agent: data.document.agent });
    if (url.pathname === "/api/collateral/mock-collateral") {
      data.document = { ...data.document, template_id: body.template_id ?? data.document.template_id,
        copy: { ...data.document.copy, ...body.copy }, property: { ...data.document.property, ...body.property } };
      data.document = { ...data.document, content_saved_at: new Date().toISOString() };
      data.collateral = { ...data.collateral, template_id: body.template_id ?? data.collateral.template_id, document_json: data.collateral.document_json ? data.document : null, pdf_url: null };
      return Response.json({ collateral: data.collateral });
    }
    if (url.pathname === "/api/leads") return Response.json({ leads: [data.lead] });
    if (url.pathname === "/api/leads/mock-lead") {
      data.lead = { ...data.lead, ...body };
      return Response.json({ lead: data.lead });
    }
    onRequest(`BLOCKED ${label}`);
    return Response.json({ error: `No mock configured for ${label}` }, { status: 501 });
  };
  return () => { window.fetch = original; };
}
