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
    const reports = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b" }, error: null }) };
    const rpc = vi.fn().mockResolvedValue({ data: { report_id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b", created: true, estimate_reused: true }, error: null });
    const from = vi.fn((table: string) => table === "reports" ? reports : query);
    return { query, reports, rpc, from, admin: { from, rpc } as unknown as SupabaseClient };
  }
  it("scopes the raw lead lookup to the current agency and creates through one atomic RPC", async () => {
    const db = database();
    await createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin });
    expect(db.query.eq).toHaveBeenCalledWith("agency_id", agency.id);
    expect(db.rpc).toHaveBeenCalledWith("create_str_calculator_lead_report", expect.objectContaining({ p_agency_id: agency.id, p_lead_id: lead.id, p_user_id: "user-a", p_template_id: "standard-2-page" }));
    expect(db.from).toHaveBeenCalledExactlyOnceWith("str_calculator_leads");
    expect(mocks.occupancy).not.toHaveBeenCalled();
    expect(mocks.property).not.toHaveBeenCalled();
    const draft = db.rpc.mock.calls[0][1].p_draft;
    const baseline = calculatorLeadReportDraft(lead, agency, now);
    expect(draft).toEqual(baseline);
    expect(draft.overrides.calculatorReview.status).toBe("pending");
  });
  it("reopens an existing linked report without recalculating its snapshot or resolving current templates", async () => {
    const db = database({ ...lead, report_id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b", original_estimate_json: null });
    await createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin });
    expect(mocks.templates).not.toHaveBeenCalled();
    expect(mocks.property).not.toHaveBeenCalled();
    expect(mocks.occupancy).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith("create_str_calculator_lead_report", expect.objectContaining({ p_template_id: null, p_draft: null }));
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
  ])("persists pending verification for a new empty draft without fetching provider evidence", async (value) => {
    const db = database(value);
    const created = { report_id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b", created: true, estimate_reused: false };
    db.rpc.mockResolvedValue({ data: created, error: null });
    expect(await createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin })).toEqual(created);
    expect(mocks.occupancy).not.toHaveBeenCalled();
    expect(mocks.property).not.toHaveBeenCalled();
    expect(db.rpc.mock.calls[0][1].p_draft.enrichment).toBeNull();
    const overrides = db.rpc.mock.calls[0][1].p_draft.overrides;
    expect(overrides.calculatorReview).toEqual({ status: "pending", propertyKey: expect.any(String) });
    expect(overrides.calculatorReview.propertyKey.length).toBeGreaterThan(0);
    expect(overrides.estimateInputs).toEqual({ bedrooms: 3, bathrooms: 1.5, accommodates: 6 });
    expect(db.reports.update).toHaveBeenCalledExactlyOnceWith({ user_overrides_json: overrides });
    expect(db.reports.eq.mock.calls).toEqual([["id", created.report_id], ["agency_id", agency.id]]);
    expect(db.reports.is.mock.calls).toEqual([["original_estimate_json", null], ["final_report_json", null]]);
    expect(db.reports.maybeSingle).toHaveBeenCalledTimes(1);
  });
  it("does not backfill verification on an existing empty report returned by the atomic RPC", async () => {
    const db = database({ ...lead, report_id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b", original_estimate_json: null });
    db.rpc.mockResolvedValue({ data: { report_id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b", created: false, estimate_reused: false }, error: null });
    await createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin });
    expect(db.from).toHaveBeenCalledExactlyOnceWith("str_calculator_leads");
    expect(db.reports.update).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: null }, { data: null, error: { message: "private database detail" } }])(
    "reports incomplete preparation when the pending marker cannot be saved", async saved => {
      const db = database({ ...lead, status: "failed", original_estimate_json: null });
      db.rpc.mockResolvedValue({ data: { report_id: "fedbeef0-607a-4b42-8888-9cc63ab8b89b", created: true, estimate_reused: false }, error: null });
      db.reports.maybeSingle.mockResolvedValue(saved);
      await expect(createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin })).rejects.toMatchObject({
        status: 503, message: "The draft was created, but verification could not be prepared. Open it from your leads to review the property.",
      });
      expect(db.reports.update).toHaveBeenCalledTimes(1);
      expect(db.rpc).toHaveBeenCalledTimes(1);
    },
  );
  it("does not retry failed writes or return private database errors", async () => {
    const db = database();
    db.rpc.mockResolvedValue({ error: { message: "private database detail" }, data: null });
    await expect(createReportFromCalculatorLead({ leadId: lead.id, agency, userId: "user-a", admin: db.admin })).rejects.toMatchObject({ status: 503, message: "Couldn’t create the report. Please try again." });
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
});
