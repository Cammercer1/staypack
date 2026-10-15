import { afterEach, expect, it, vi } from "vitest";
import { fetchStrEstimate } from "./estimate";
import { fetchAirroiEstimate, normaliseAirroiResponse } from "@/lib/airroi/client";
import { fetchAirroiMarketOccupancy } from "@/lib/airroi/marketOccupancy";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/airroi/client", async (original) => ({ ...await original<typeof import("@/lib/airroi/client")>(), fetchAirroiEstimate: vi.fn() }));
vi.mock("@/lib/airroi/marketOccupancy", () => ({ fetchAirroiMarketOccupancy: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("uses the AirROI headline without model calls or sparse-comp retries", async () => {
  const f = createLintRegressionFixtures();
  const input = { latitude: -33.9, longitude: 151.2, bedrooms: 3, bathrooms: 2, accommodates: 6 };
  const result = normaliseAirroiResponse({ currency: "AUD", revenue: 63638.64, occupancy: .5645543, average_daily_rate: 318.6921,
    percentiles: { revenue: { p25: 36000, p50: 60000, p75: 82000, p90: 108000 }, occupancy: { p25: .39, p50: .58, p75: .73, p90: .82 }, average_daily_rate: { p25: 225, p50: 293, p75: 380, p90: 492 } },
    monthly_revenue_distributions: Array(12).fill(1 / 12), comparable_listings: [],
  }, input);
  vi.mocked(fetchAirroiEstimate).mockResolvedValue(result);
  vi.mocked(fetchAirroiMarketOccupancy).mockResolvedValue({ status: "unavailable", cost_cents: 0 } as Awaited<ReturnType<typeof fetchAirroiMarketOccupancy>>);
  const network = vi.fn(); vi.stubGlobal("fetch", network);
  const saved = await fetchStrEstimate(input, f.listing);
  expect(saved.estimate.annualRevenue).toBe(63639);
  expect(saved.enrichment.positioning).toBeUndefined();
  expect(saved.enrichment.comps).toHaveLength(0);
  expect(saved.enrichment.seasonality.reduce((sum, row) => sum + row.revenue!, 0)).toBe(63639);
  expect(saved.enrichment.cost_cents).toBe(20);
  expect(fetchAirroiEstimate).toHaveBeenCalledTimes(1);
  expect(fetchAirroiMarketOccupancy).toHaveBeenCalledTimes(1);
  expect(network).not.toHaveBeenCalled();
});

it("adds broader occupancy evidence and its bounded cost without repricing the subject or changing comparable selection", async () => {
  const f = createLintRegressionFixtures();
  const input = { latitude: -33.9, longitude: 151.2, bedrooms: 3, bathrooms: 2, accommodates: 6 };
  const estimate = f.report.original_estimate_json!;
  const enrichment = { ...f.report.str_enrichment_json!, cost_cents: 20 };
  vi.mocked(fetchAirroiEstimate).mockResolvedValue({ estimate, enrichment });
  const history: Awaited<ReturnType<typeof fetchAirroiMarketOccupancy>> = {
    status: "available", cost_cents: 21, benchmark_scope: "all_property_types",
    market: { country: "Australia", region: "New South Wales", locality: "Sydney" },
    label: "Sydney · 3-bed entire homes · all property types", filters: { room_type: { eq: "entire_home" }, bedrooms: { eq: 3 } },
    fetched_at: "2026-10-10", request_key: "broad", sample_count: null, warnings: [],
    months: [{ month: "2026-09", average: 40, p25: 25, p50: 35, p75: 60, p90: 80 }],
  };
  vi.mocked(fetchAirroiMarketOccupancy).mockResolvedValue(history);
  const saved = await fetchStrEstimate(input, { ...f.listing, property_type: "Duplex" });
  expect(saved.estimate).toEqual(estimate);
  expect(saved.enrichment).toMatchObject({ market_occupancy: history, cost_cents: 41, comps: enrichment.comps });
  expect(saved.enrichment.selected_comp_ids).toEqual(enrichment.selected_comp_ids);
  expect(saved.enrichment.comp_pool).toEqual(enrichment.comp_pool);
  expect(fetchAirroiEstimate).toHaveBeenCalledOnce();
  expect(fetchAirroiMarketOccupancy).toHaveBeenCalledOnce();
});

it.each([0, 11])("preserves cached calculator provenance and adds only %i cents of independent occupancy cost", async (occupancyCost) => {
  const f = createLintRegressionFixtures();
  const fetchedAt = "2026-10-01T03:00:00.000Z";
  const input = { latitude: -33.9, longitude: 151.2, bedrooms: 4, bathrooms: 2, accommodates: 8, radiusM: 2000 };
  const estimate = {
    ...f.report.original_estimate_json!,
    raw: { provider: "airroi", input, fetched_at: fetchedAt, request_id: "original-provider-request", response: { revenue: 63639 } },
  };
  const enrichment = { ...f.report.str_enrichment_json!, fetched_at: fetchedAt, request_id: "original-provider-request", cost_cents: 0 };
  const occupancy = { status: "unavailable", cost_cents: occupancyCost } as Awaited<ReturnType<typeof fetchAirroiMarketOccupancy>>;
  f.report.str_enrichment_json = { ...f.report.str_enrichment_json!, market_occupancy: occupancy };
  const previousReport = structuredClone(f.report);
  const originalProviderResult = structuredClone({ estimate, enrichment });
  vi.mocked(fetchAirroiEstimate).mockResolvedValue({ estimate, enrichment });
  vi.mocked(fetchAirroiMarketOccupancy).mockResolvedValue(occupancy);

  const saved = await fetchStrEstimate(input, f.listing, f.report.str_enrichment_json);

  expect(saved.enrichment.cost_cents).toBe(occupancyCost);
  expect(saved.enrichment.fetched_at).toBe(fetchedAt);
  expect(saved.enrichment.request_id).toBe("original-provider-request");
  expect(saved.estimate.raw).toEqual(estimate.raw);
  expect(fetchAirroiEstimate).toHaveBeenCalledExactlyOnceWith({ ...input, currency: "AUD", property_type: f.listing.property_type, suburb: f.listing.suburb });
  expect(fetchAirroiMarketOccupancy).toHaveBeenCalledWith(expect.objectContaining(input), f.listing, occupancy);
  expect({ estimate, enrichment }).toEqual(originalProviderResult);
  expect(f.report).toEqual(previousReport);
});
