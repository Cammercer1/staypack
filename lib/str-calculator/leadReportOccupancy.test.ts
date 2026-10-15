import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agency } from "@/lib/types";

const mocks = vi.hoisted(() => ({ templates: vi.fn(), admin: vi.fn(), shared: new Map<string, unknown>() }));
vi.mock("server-only", () => ({}));
// This suite isolates the real occupancy adapter; property imports have their own integration coverage.
vi.mock("./leadProperty", () => ({ lookupCalculatorLeadProperty: vi.fn().mockRejectedValue(new Error("No property profile")) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/templates/resolveAvailableTemplates", () => ({ resolveAvailableTemplates: mocks.templates }));
// Keep the real market adapter/cache helper, replacing only Next's storage layer.
vi.mock("next/cache", () => ({ unstable_cache: (load: () => Promise<unknown>, parts: string[]) => async () => {
  const key = JSON.stringify(parts);
  if (mocks.shared.has(key)) return structuredClone(mocks.shared.get(key));
  const value = await load();
  mocks.shared.set(key, structuredClone(value));
  return value;
} }));

import { calculatorLeadReportDraft, createReportFromCalculatorLead, type CalculatorReportLead } from "./leadReport";

const now = new Date("2026-10-15T00:00:00.000Z");
const fetchedAt = "2026-10-01T00:00:00.123456+00:00";
const reportId = "fedbeef0-607a-4b42-8888-9cc63ab8b89b";
type Draft = ReturnType<typeof calculatorLeadReportDraft>;
const markets = {
  AU: { country: "Australia", region: "New South Wales", locality: "Sydney" },
  US: { country: "United States", region: "California", locality: "Los Angeles" },
};

function fixture(country: "AU" | "US" = "AU") {
  const agency = { id: `agency-${country}`, country_code: country, str_management_presets: [{
    id: "b36d1c4d-1e87-4b5e-9ea3-f7c42aae1d51", name: "Managed", mode: "uplift", upliftPercent: 10, isDefault: true,
    assumptions: { unavailableNights: 0, listingStage: "established", rationale: "Professional management" },
  }] } as Agency;
  const input = { currency: country === "AU" ? "AUD" : "USD", latitude: country === "AU" ? -33.90836 : 34.080734,
    longitude: country === "AU" ? 151.22473 : -118.37964, bedrooms: 3, bathrooms: 1.5, accommodates: 6, radiusM: 2000 };
  const response = {
    currency: input.currency, revenue: 60000, occupancy: .6, average_daily_rate: 300,
    percentiles: { revenue: { p25: 40000, p50: 60000, p75: 80000, p90: 100000 },
      occupancy: { p25: .4, p50: .6, p75: .7, p90: .8 }, average_daily_rate: { p25: 200, p50: 300, p75: 400, p90: 500 } },
    monthly_revenue_distributions: Array(12).fill(1 / 12),
    // More than six makes loss of either the retained pool or selected subset observable.
    comparable_listings: Array.from({ length: 8 }, (_, index) => ({
      listing_info: { listing_id: String(100000 + index), listing_name: `Comparable ${index + 1}`,
        listing_type: "Entire rental unit", room_type: "entire_home", cover_photo_url: `https://images.example.com/${index}.jpg` },
      location_info: { latitude: input.latitude + index * .0001, longitude: input.longitude, locality: markets[country].locality },
      property_details: { bedrooms: 3, baths: 1.5, guests: 6 }, ratings: { num_reviews: 25, rating_overall: 4.8 },
      performance_metrics: { ttm_revenue: 60000 + index * 1000, ttm_occupancy: .6, ttm_avg_rate: 300, ttm_days_reserved: 219 },
    })),
  };
  const raw = { provider: "airroi", input, response, fetched_at: fetchedAt, request_id: "original-calculator-request" };
  const lead: CalculatorReportLead = { id: `lead-${country}`, agency_id: agency.id, report_id: null,
    address: country === "AU" ? "1/24 Test Street, Sydney NSW 2000" : "123 N Main Street, Los Angeles, CA 90048",
    bedrooms: 3, country, status: "estimated", input_json: { bathrooms: 1.5 }, original_estimate_json: raw,
    completed_at: "2026-10-14T00:00:00.000Z" };
  return { agency, lead, raw, input, market: markets[country] };
}

function database(lead: CalculatorReportLead) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: lead, error: null }) };
  const rpc = vi.fn().mockResolvedValue({ data: { report_id: reportId, created: !lead.report_id, estimate_reused: true }, error: null });
  const from = vi.fn().mockImplementation((table: string) => {
    if (table !== "str_calculator_leads") throw new Error(`Unexpected database access: ${table}`);
    return query;
  });
  return { rpc, from, admin: { from, rpc } as unknown as SupabaseClient,
    draft: () => rpc.mock.calls[0][1].p_draft as Draft };
}

function provider(market: typeof markets.AU, occupancyStatus = 200) {
  const fetcher = vi.fn(async (request: string | URL | Request, options?: RequestInit) => {
    const url = new URL(request instanceof Request ? request.url : String(request));
    if (url.origin !== "https://api.airroi.com") throw new Error(`Unexpected external request: ${url}`);
    if (url.pathname === "/markets/lookup") return Response.json(market);
    if (url.pathname === "/markets/metrics/occupancy") {
      expect(options?.method).toBe("POST");
      return occupancyStatus === 200 ? Response.json({ market, results: Array.from({ length: 12 }, (_, index) => ({
        date: new Date(Date.UTC(2025, 9 + index, 1)).toISOString().slice(0, 10),
        avg: .55, p25: .25, p50: .58, p75: .79, p90: .9,
      })) }) : Response.json({ error: "Temporarily unavailable" }, { status: occupancyStatus });
    }
    // A calculator call is a regression: no real network or provider retry is allowed.
    throw new Error(`Unexpected provider request: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

function expectPreservedSeed(actual: Draft, seed: Draft) {
  expect(actual.original_estimate).toEqual(seed.original_estimate);
  expect(actual.final_estimate).toEqual(seed.final_estimate);
  expect(actual.overrides).toEqual(seed.overrides);
  expect(actual.property).toEqual(seed.property);
  expect(actual.fetched_at).toBe(fetchedAt);
  expect(actual.enrichment?.comp_pool).toEqual(seed.enrichment?.comp_pool);
  expect(actual.enrichment?.comp_pool).toHaveLength(8);
  expect(actual.enrichment?.comps).toEqual(seed.enrichment?.comps);
  expect(actual.enrichment?.comps).toHaveLength(6);
  expect(actual.enrichment?.selected_comp_ids).toEqual(seed.enrichment?.selected_comp_ids);
  expect(actual.enrichment?.seasonality).toEqual(seed.enrichment?.seasonality);
  expect(actual.enrichment).toMatchObject({ fetched_at: fetchedAt, request_id: "original-calculator-request", cache_status: "hit" });
}

beforeEach(() => {
  vi.clearAllMocks(); mocks.shared.clear();
  mocks.templates.mockResolvedValue({ defaultTemplateId: "standard-2-page" });
  vi.useFakeTimers(); vi.setSystemTime(now);
  vi.stubEnv("AIRROI_API_KEY", "test-occupancy-key");
  vi.stubEnv("BILLING_MODE", "disabled");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("calculator lead report market evidence integration", () => {
  it.each(["AU", "US"] as const)("completes a fresh %s lead with occupancy while retaining its estimate and all comparables", async (country) => {
    const f = fixture(country);
    const untouched = structuredClone(f.lead);
    const seed = calculatorLeadReportDraft(f.lead, f.agency);
    const db = database(f.lead);
    const fetcher = provider(f.market);
    await createReportFromCalculatorLead({ leadId: f.lead.id, agency: f.agency, userId: "user-a", admin: db.admin });

    const draft = db.draft();
    expectPreservedSeed(draft, seed);
    expect(draft.original_estimate?.raw).toEqual(f.raw);
    expect(draft.original_estimate?.annualRevenue).toBe(60000);
    expect(draft.final_estimate?.annualRevenue).toBe(66000);
    expect(draft.enrichment?.market_occupancy).toMatchObject({ status: "available", market: f.market,
      fetched_at: now.toISOString(), cost_cents: 11, benchmark_scope: "all_property_types",
      filters: { bedrooms: { eq: 3 }, room_type: { eq: "entire_home" } } });
    expect(draft.enrichment?.market_occupancy?.months).toHaveLength(12);
    expect(draft.enrichment?.market_occupancy?.months[0]).toMatchObject({ month: "2025-10", p25: 25, p75: 79 });
    expect(draft.enrichment?.market_occupancy?.months.at(-1)?.month).toBe("2026-09");
    expect(draft.enrichment?.cost_cents).toBe(11);
    expect(fetcher.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(["/markets/lookup", "/markets/metrics/occupancy"]);
    const lookup = new URL(String(fetcher.mock.calls[0][0]));
    expect(lookup.searchParams.get("lat")).toBe(String(f.input.latitude));
    expect(lookup.searchParams.get("lng")).toBe(String(f.input.longitude));
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toEqual({ market: f.market,
      filter: { room_type: { eq: "entire_home" }, bedrooms: { eq: 3 } }, num_months: 13, currency: "native" });
    expect(db.from).toHaveBeenCalledExactlyOnceWith("str_calculator_leads");
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("create_str_calculator_lead_report", expect.objectContaining({ p_draft: draft }));
    expect(f.lead).toEqual(untouched);
    expect(JSON.stringify(draft)).not.toContain("test-occupancy-key");
  });

  it("shares market evidence with a later new report without refreshing the calculator or either evidence timestamp", async () => {
    const f = fixture();
    const fetcher = provider(f.market);
    const first = database(f.lead);
    await createReportFromCalculatorLead({ leadId: f.lead.id, agency: f.agency, userId: "user-a", admin: first.admin });
    vi.setSystemTime(new Date("2026-10-15T01:00:00Z"));
    const anotherAgency = { ...f.agency, id: "agency-other" };
    const anotherLead = { ...f.lead, id: "lead-other", agency_id: anotherAgency.id };
    const second = database(anotherLead);
    await createReportFromCalculatorLead({ leadId: anotherLead.id, agency: anotherAgency, userId: "user-b", admin: second.admin });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(second.draft().enrichment?.market_occupancy).toMatchObject({ status: "available", cost_cents: 0, fetched_at: now.toISOString() });
    expect(second.draft().enrichment?.cost_cents).toBe(0);
    expect(second.draft().enrichment?.market_occupancy?.months).toEqual(first.draft().enrichment?.market_occupancy?.months);
    expect(second.draft().fetched_at).toBe(fetchedAt);
    expect(second.draft().original_estimate).toEqual(first.draft().original_estimate);
    expect(second.draft().enrichment?.comps).toEqual(first.draft().enrichment?.comps);
  });

  it("keeps a valid estimate and comparables when the market request fails, recording an unavailable fallback without retry", async () => {
    const f = fixture();
    const seed = calculatorLeadReportDraft(f.lead, f.agency);
    const db = database(f.lead);
    const fetcher = provider(f.market, 503);
    await createReportFromCalculatorLead({ leadId: f.lead.id, agency: f.agency, userId: "user-a", admin: db.admin });

    expectPreservedSeed(db.draft(), seed);
    expect(db.draft().enrichment?.market_occupancy).toMatchObject({ status: "unavailable", unavailable_reason: "request_failed", months: [], cost_cents: 11 });
    expect(db.draft().enrichment?.cost_cents).toBe(11);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it("reopens an existing report without market requests or a replacement draft", async () => {
    const f = fixture();
    const db = database({ ...f.lead, report_id: reportId });
    const fetcher = provider(f.market);
    expect(await createReportFromCalculatorLead({ leadId: f.lead.id, agency: f.agency, userId: "user-a", admin: db.admin }))
      .toMatchObject({ report_id: reportId, created: false });
    expect(fetcher).not.toHaveBeenCalled();
    expect(mocks.templates).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("create_str_calculator_lead_report", expect.objectContaining({ p_draft: null, p_template_id: null }));
  });

  it("leaves expired calculator evidence for the normal estimate flow without making a partial market request", async () => {
    const f = fixture();
    const db = database({ ...f.lead, original_estimate_json: { ...f.raw, fetched_at: "2026-09-15T00:00:00.000Z" } });
    const fetcher = provider(f.market);
    await createReportFromCalculatorLead({ leadId: f.lead.id, agency: f.agency, userId: "user-a", admin: db.admin });
    expect(db.draft()).toMatchObject({ original_estimate: null, final_estimate: null, enrichment: null, fetched_at: null });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
