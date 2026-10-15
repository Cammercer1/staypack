import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agency } from "@/lib/types";

const mocks = vi.hoisted(() => ({ templates: vi.fn(), admin: vi.fn(), occupancy: vi.fn(), property: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/templates/resolveAvailableTemplates", () => ({ resolveAvailableTemplates: mocks.templates }));
vi.mock("@/lib/airroi/marketOccupancy", () => ({ fetchAirroiMarketOccupancy: mocks.occupancy }));
vi.mock("./leadProperty", () => ({ lookupCalculatorLeadProperty: mocks.property }));
import { calculatorLeadReportDraft, createReportFromCalculatorLead, type CalculatorReportLead } from "./leadReport";

const now = Date.parse("2026-10-15T00:00:00.000Z");
const fetchedAt = "2026-10-01T00:00:00.000Z";
const input = { currency: "AUD", latitude: -33.9, longitude: 151.2, bedrooms: 3, bathrooms: 1.5, accommodates: 6, radiusM: 2000 };
const response = {
  currency: "AUD", revenue: 60000, occupancy: .6, average_daily_rate: 300,
  percentiles: { revenue: { p25: 40000, p50: 60000, p75: 80000, p90: 100000 },
    occupancy: { p25: .4, p50: .6, p75: .7, p90: .8 }, average_daily_rate: { p25: 200, p50: 300, p75: 400, p90: 500 } },
  monthly_revenue_distributions: Array(12).fill(1 / 12), comparable_listings: [],
};
const raw = { provider: "airroi", input, response, fetched_at: fetchedAt, request_id: "provider-request" };
const agency = { id: "agency-a", country_code: "AU" } as Agency;
const lead: CalculatorReportLead = { id: "lead-a", agency_id: agency.id, report_id: null, address: "1/24 Test Street, Sydney NSW 2000",
  bedrooms: 3, country: "AU", status: "estimated", input_json: { bathrooms: 1.5 }, original_estimate_json: raw,
  completed_at: "2026-10-14T00:00:00.000Z" };

const marketOccupancy = { label: "Edgeworth · 3-bed entire homes", status: "available", cost_cents: 11, fetched_at: "2026-10-15T00:00:00Z", months: [{ month: "2026-09", average: 55 }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now);
  mocks.templates.mockResolvedValue({ defaultTemplateId: "standard-2-page" });
  mocks.occupancy.mockResolvedValue(marketOccupancy);
  mocks.property.mockRejectedValue(new Error("No profile"));
});
afterEach(() => { vi.restoreAllMocks(); });

describe("calculator lead draft snapshot", () => {
  it("reuses the full fresh baseline and exact inputs with original provenance at zero new provider cost", () => {
    const before = JSON.stringify(lead);
    const draft = calculatorLeadReportDraft(lead, agency, now);
    expect(draft.original_estimate?.annualRevenue).toBe(60000);
    expect(draft.original_estimate?.raw).toEqual(raw);
    expect(draft.enrichment).toMatchObject({ fetched_at: fetchedAt, request_id: "provider-request", cost_cents: 0, cache_status: "hit", seasonality_basis: "modelled" });
    expect(draft.source_address).toBe(lead.address);
    expect(draft.property).toMatchObject({ property_address: "1/24 Test Street", suburb: "Sydney", state: "NSW", postcode: "2000", latitude: -33.9, longitude: 151.2, bathrooms: 1.5, accommodates: 6 });
    expect(draft.overrides.estimateInputs).toEqual({ bedrooms: 3, bathrooms: 1.5, accommodates: 6 });
    expect(JSON.stringify(lead)).toBe(before);
  });

  it("applies agency assumptions only to the new final estimate and keeps the provider baseline intact", () => {
    const withPreset = { ...agency, str_management_presets: [{ id: "b36d1c4d-1e87-4b5e-9ea3-f7c42aae1d51", name: "Managed", mode: "uplift", upliftPercent: 10, isDefault: true,
      assumptions: { unavailableNights: 0, listingStage: "established", rationale: "Professional management" } }] } as Agency;
    const draft = calculatorLeadReportDraft(lead, withPreset, now);
    expect(draft.original_estimate?.annualRevenue).toBe(60000);
    expect(draft.final_estimate?.annualRevenue).toBe(66000);
    expect(draft.overrides.strManagement?.presetName).toBe("Managed");
  });

  it("supports legacy leads without a provider timestamp using their original completion time", () => {
    const legacyRaw = { provider: raw.provider, input, response, request_id: raw.request_id };
    const draft = calculatorLeadReportDraft({ ...lead, original_estimate_json: legacyRaw }, agency, now);
    expect(draft.fetched_at).toBe(lead.completed_at);
  });

  it("preserves database timestamp precision when comparing the seed to its source", () => {
    const timestamp = "2026-10-01T00:00:00.123456+00:00";
    const draft = calculatorLeadReportDraft({ ...lead, original_estimate_json: { ...raw, fetched_at: timestamp } }, agency, now);
    expect(draft.fetched_at).toBe(timestamp);
    expect(draft.original_estimate?.raw).toMatchObject({ fetched_at: timestamp });
  });

  it.each([
    "2026-09-15T00:00:00.000Z", // exactly 30 days
    "2026-09-01T00:00:00.000Z", "2026-10-16T00:00:00.000Z", "invalid", null,
  ])("does not revive an expired, future or invalid provider date (%s) using a recent submission", (fetched_at) => {
    const draft = calculatorLeadReportDraft({ ...lead, original_estimate_json: { ...raw, fetched_at } }, agency, now);
    expect(draft.original_estimate).toBeNull();
    expect(draft.final_estimate).toBeNull();
    expect(draft.enrichment).toBeNull();
    expect(draft.source_address).toBe(lead.address);
    expect(draft.property.property_address).toBe("1/24 Test Street");
  });

  it.each([
    { ...raw, provider: "mock" }, { ...raw, response: { revenue: 60000 } },
    { ...raw, input: { ...input, bedrooms: 2 } }, { ...raw, input: { ...input, bathrooms: 2 } },
    { ...raw, input: { ...input, currency: "USD" } }, { ...raw, input: { ...input, accommodates: 20 } }, null,
  ])("leaves a draft needing evidence when the saved baseline is invalid or incompatible", (original_estimate_json) => {
    expect(calculatorLeadReportDraft({ ...lead, original_estimate_json }, agency, now).original_estimate).toBeNull();
  });

  it("allows a failed enquiry to start a property draft without inventing an estimate", () => {
    const draft = calculatorLeadReportDraft({ ...lead, status: "failed", original_estimate_json: null }, agency, now);
    expect(draft.property).toMatchObject({ bedrooms: 3, bathrooms: 1.5, accommodates: 6, latitude: null, longitude: null });
    expect(draft.original_estimate).toBeNull();
  });

  it("enforces the account country before preparing a new report", () => {
    expect(() => calculatorLeadReportDraft({ ...lead, country: "US" }, agency, now)).toThrow(/Australia/);
  });
});

describe("calculator lead report orchestration", () => {
  function database(value: CalculatorReportLead | null = lead) {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: value, error: null }) };
    const rpc = vi.fn().mockResolvedValue({ data: { report_id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b", created: true, estimate_reused: true }, error: null });
    const from = vi.fn().mockReturnValue(query);
    return { query, rpc, from, admin: { from, rpc } as unknown as SupabaseClient };
  }
  it("scopes the raw lead lookup to the current agency and creates through one atomic RPC", async () => {
    const db = database();
    await createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin });
    expect(db.query.eq).toHaveBeenCalledWith("agency_id", agency.id);
    expect(db.rpc).toHaveBeenCalledWith("create_str_calculator_lead_report", expect.objectContaining({ p_agency_id: agency.id, p_lead_id: lead.id, p_user_id: "user-a", p_template_id: "standard-2-page" }));
    expect(db.from).toHaveBeenCalledExactlyOnceWith("str_calculator_leads");
    expect(mocks.occupancy).toHaveBeenCalledExactlyOnceWith(input, expect.objectContaining({ country: "Australia", state: "NSW", suburb: "Sydney" }));
    const draft = db.rpc.mock.calls[0][1].p_draft;
    const baseline = calculatorLeadReportDraft(lead, agency, now);
    expect(draft).toEqual({ ...baseline, enrichment: { ...baseline.enrichment, market_occupancy: marketOccupancy, cost_cents: 11 } });
    expect(mocks.occupancy.mock.invocationCallOrder[0]).toBeLessThan(db.rpc.mock.invocationCallOrder[0]);
  });
  it("reopens an existing linked report without recalculating its snapshot or resolving current templates", async () => {
    const db = database({ ...lead, report_id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b", original_estimate_json: null });
    await createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin });
    expect(mocks.templates).not.toHaveBeenCalled();
    expect(mocks.property).not.toHaveBeenCalled();
    expect(mocks.occupancy).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith("create_str_calculator_lead_report", expect.objectContaining({ p_template_id: null, p_draft: null }));
  });
  it("does not initialise property evidence when another request already created the report", async () => {
    const db = database();
    mocks.property.mockResolvedValue({ hero_image_url: "https://example.com/photo.jpg", selected_image_urls: [], scraped_listing_json: null });
    db.rpc.mockResolvedValue({ data: { report_id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b", created: false, estimate_reused: true }, error: null });
    const result = await createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin });
    expect(result.warnings).toEqual([]);
    expect(db.from).toHaveBeenCalledExactlyOnceWith("str_calculator_leads");
  });
  it("returns an actionable warning and the created report link if saving imported photos fails", async () => {
    const db = database();
    mocks.property.mockResolvedValue({ hero_image_url: "https://example.com/photo.jpg", selected_image_urls: [], scraped_listing_json: null });
    db.from.mockImplementation(table => { if (table !== "str_calculator_leads") throw new Error("Unavailable database"); return db.query; });
    const result = await createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin });
    expect(result.created).toBe(true);
    expect(result.warnings.join(" ")).toContain("property photos could not be saved");
  });
  it("returns not-found for another agency's lead before any write", async () => {
    const db = database(null);
    await expect(createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin })).rejects.toMatchObject({ status: 404 });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(mocks.occupancy).not.toHaveBeenCalled();
  });
  it.each([
    { ...lead, status: "failed" as const, original_estimate_json: null },
    { ...lead, original_estimate_json: { ...raw, fetched_at: "2026-09-01T00:00:00Z" } },
    { ...lead, original_estimate_json: { ...raw, response: { revenue: 60000 } } },
  ])("does not fetch market evidence when a new draft cannot reuse its baseline", async (value) => {
    const db = database(value);
    await createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin });
    expect(mocks.occupancy).not.toHaveBeenCalled();
    expect(db.rpc.mock.calls[0][1].p_draft.enrichment).toBeNull();
  });
  it("does not retry failed writes or return private database errors", async () => {
    const db = database();
    db.rpc.mockResolvedValue({ error: { message: "private database detail" }, data: null });
    await expect(createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin })).rejects.toMatchObject({ status: 503, message: "Couldn’t create the report. Please try again." });
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("enriched lead to published proposal", () => {
  it.each([true, false])("retains imported photos/rent and cached comparables in the public snapshot (occupancy available: %s)", async available => {
    const { createLintRegressionFixtures } = await import("@/components/dev/lintRegressionFixtures");
    const { proposalFromAppraisal } = await import("@/lib/digital-proposals/fromAppraisal");
    const { proposalSnapshotSchema } = await import("@/lib/digital-proposals/workspace");
    const { viewerSnapshotSchema } = await import("@/lib/digital-proposals/viewerSnapshot");
    const { proposalPrintHtml } = await import("@/lib/digital-proposals/print");
    const { DEFAULT_PROPOSAL_DRAFT } = await import("@/lib/digital-proposals/template");
    const { BRAND_DEFAULTS } = await import("@/lib/digital-proposals/brand");
    const f = createLintRegressionFixtures();
    const photo = "https://example.com/verified-property.jpg";
    const evidence = { hero_image_url: photo, selected_image_urls: [photo], listing_image_meta: {}, property_type: "house", car_spaces: 1,
      scraped_listing_json: { images: [photo], domainAvm: { rentalEstimate: { weeklyRent: 850 } } } };
    mocks.property.mockResolvedValue(evidence);
    mocks.occupancy.mockResolvedValue({ ...marketOccupancy, status: available ? "available" : "unavailable", months: available ? marketOccupancy.months : [],
      market: { locality: "Edgeworth" }, unavailable_reason: available ? undefined : "insufficient_data" });
    let savedDraft: ReturnType<typeof calculatorLeadReportDraft>;
    let savedEvidence = {};
    const leadQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: lead }) };
    const reportQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { listing_id: f.listing.id } }) };
    const listingQuery = { update: vi.fn(value => { savedEvidence = value; return listingQuery; }), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: f.listing.id } }) };
    const admin = { from: vi.fn(table => table === "str_calculator_leads" ? leadQuery : table === "reports" ? reportQuery : listingQuery),
      rpc: vi.fn(async (_name, args) => { savedDraft = args.p_draft; return { data: { report_id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b", created: true, estimate_reused: true } }; }) };
    const result = await createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: admin as unknown as SupabaseClient });
    expect(result.warnings).toEqual([]);
    expect(savedDraft!.overrides.strProperty?.weeklyRent).toBe(850);
    const listing = { ...f.listing, ...savedDraft!.property, ...savedEvidence };
    const report = { ...f.report, status: "estimated" as const, final_report_json: null, original_estimate_json: savedDraft!.original_estimate,
      final_estimate_json: savedDraft!.final_estimate, user_overrides_json: savedDraft!.overrides, str_enrichment_json: { ...savedDraft!.enrichment!, comps: f.report.str_enrichment_json!.comps } };
    const data = proposalFromAppraisal({ ...f, agencyAgents: [f.agent], listing, report, editable: true });
    const snapshot = proposalSnapshotSchema.parse({ version: 1, data, brand: BRAND_DEFAULTS, draft: DEFAULT_PROPOSAL_DRAFT, attachments: [] });
    const frozen = JSON.stringify(snapshot);
    const publicSnapshot = viewerSnapshotSchema.parse(JSON.parse(frozen));
    expect(publicSnapshot.data.property.heroImageUrl).toBe(photo);
    expect(publicSnapshot.data.property.gallery).toContain(photo);
    expect(publicSnapshot.data.ltr.weeklyRent).toBe(850);
    expect(publicSnapshot.data.ltr.annualRent).toBe(44200);
    expect(publicSnapshot.data.str.market.annualRevenue).toBe(60000);
    expect(publicSnapshot.data.comparables.length).toBeGreaterThan(0);
    const html = proposalPrintHtml(publicSnapshot);
    expect(html).toContain(photo);
    expect(html).toContain("44,200");
    if (available) {
      expect(publicSnapshot.data.occupancy?.months.at(-1)?.average).toBe(55);
      expect(publicSnapshot.data.occupancyNotice).toBeUndefined();
      expect(html).toContain("55%");
    } else {
      expect(publicSnapshot.data.occupancy).toBeNull();
      expect(publicSnapshot.data.occupancyNotice).toContain("Edgeworth");
      expect(html).toContain("not enough matching market data");
    }
    listing.hero_image_url = "https://example.com/new.jpg";
    report.user_overrides_json!.strProperty!.weeklyRent = 1;
    expect(JSON.stringify(publicSnapshot)).toBe(frozen);
  });
});
