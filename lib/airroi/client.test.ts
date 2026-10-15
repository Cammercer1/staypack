import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const cache = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  rpc: (...args: unknown[]) => ({ abortSignal: () => cache.rpc(...args) }),
}) }));
import { fetchAirroiEstimate, normaliseAirroiResponse, parseAirroiJson } from "./client";

export const input = { latitude: -33.90836, longitude: 151.22473, bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: "Apartment", suburb: "Kensington" };
export const payload = {
  currency: "AUD", revenue: 63638.64, occupancy: .5645543, average_daily_rate: 318.6921, percentiles: {
    revenue: { p25: 36000, p50: 60000, p75: 82000, p90: 108000 },
    occupancy: { p25: .39, p50: .58, p75: .73, p90: .82 },
    average_daily_rate: { p25: 225, p50: 293, p75: 380, p90: 492 },
  }, monthly_revenue_distributions: Array.from({ length: 12 }, () => 1 / 12),
  comparable_listings: [{
    listing_info: { listing_id: "906067906063315896", listing_name: "Three bedroom unit", listing_type: "Entire rental unit", room_type: "entire_home", cover_photo_url: "https://images.example.com/photo.jpg" },
    location_info: { latitude: -33.9084, longitude: 151.2248, locality: "Kensington" },
    property_details: { bedrooms: 3, baths: 2, guests: 6 }, ratings: { num_reviews: 25, rating_overall: 4.8 },
    performance_metrics: { ttm_revenue: 80000, ttm_occupancy: .6, ttm_avg_rate: 350, ttm_days_reserved: 219, ttm_blocked_days: 20 },
  }],
};

beforeEach(() => {
  const rows = new Map<string, { response: unknown; request_id: string | null; fetched_at: string; expires_at: string }>();
  cache.rpc.mockReset().mockImplementation(async (name, args) => {
    if (name === "claim_airroi_calculator_cache") {
      const row = rows.get(args.p_request_key);
      return { data: row ? { status: "hit", ...row } : { status: "claimed" }, error: null };
    }
    if (name === "complete_airroi_calculator_cache") {
      const now = Date.now();
      const row = { response: args.p_response, request_id: args.p_request_id,
        fetched_at: new Date(now).toISOString(), expires_at: new Date(now + 30 * 86400000).toISOString() };
      rows.set(args.p_request_key, row);
      return { data: row, error: null };
    }
    return { data: true, error: null };
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("AirROI calculator adapter", () => {
  it("preserves 64-bit IDs before native number rounding, including ID arrays", () => {
    expect(parseAirroiJson('{"listing_id":906067906063315896,"host_id":123,"cohost_ids":[1487030441641580047],"description":"listing_id: 906067906063315896","occupancy":0.58}')).toEqual({ listing_id: "906067906063315896", host_id: "123", cohost_ids: ["1487030441641580047"], description: "listing_id: 906067906063315896", occupancy: .58 });
  });
  it("uses the provider headline and reconciles effective ADR without inventing monthly occupancy", () => {
    const result = normaliseAirroiResponse(payload, input);
    expect(result.estimate.annualRevenue).toBe(63639);
    expect(result.estimate.occupancyRate).toBeCloseTo(56.45543);
    expect(result.estimate.nightlyRate! * result.estimate.occupancyRate! / 100 * 365).toBeCloseTo(63639);
    expect(result.enrichment.estimate_basis).toBe("provider");
    expect(result.enrichment.comps[0].listing_url).toBe("https://www.airbnb.com/rooms/906067906063315896");
    expect(result.enrichment.seasonality.every((row) => row.occupancy === null && row.adr === null && row.revenue_low === null)).toBe(true);
    expect(result.estimate.raw).toMatchObject({ provider: "airroi", response: { revenue: 63638.64, average_daily_rate: 318.6921 } });
  });
  it("rejects wrong currencies and invalid percentile or seasonal data", () => {
    expect(() => normaliseAirroiResponse({ ...payload, currency: "USD" }, input)).toThrow();
    expect(() => normaliseAirroiResponse({ ...payload, monthly_revenue_distributions: Array(12).fill(.2) }, input)).toThrow();
    expect(() => normaliseAirroiResponse({ ...payload, percentiles: { ...payload.percentiles, revenue: { p25: 90000, p50: 60000, p75: 82000, p90: 108000 } } }, input)).toThrow();
  });
  it("drops room listings, malformed comps and duplicates without losing the valid estimate", () => {
    const comp = payload.comparable_listings[0];
    const result = normaliseAirroiResponse({ ...payload, comparable_listings: [comp, comp, {}, { ...comp, listing_info: { ...comp.listing_info, listing_id: "2", room_type: "private_room" } }] }, input);
    expect(result.enrichment.comp_count).toBe(1);
  });
  it("sends one authenticated server request with explicit units and keeps keys out of persisted data", async () => {
    vi.stubEnv("AIRROI_API_KEY", "test-secret");
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { headers: { "x-request-id": "request-1" } }));
    vi.stubGlobal("fetch", request);
    const result = await fetchAirroiEstimate(input);
    const [url, init] = request.mock.calls[0];
    expect(url.searchParams.get("radius")).toBe(String(2000 / 1609.344));
    expect(url.searchParams.get("room_type")).toBe("entire_home");
    expect(init.headers).toEqual({ "X-API-KEY": "test-secret" });
    expect(result.enrichment).toMatchObject({ provider: "airroi", cost_cents: 20, request_id: "request-1" });
    expect(JSON.stringify(result)).not.toContain("test-secret");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("reports failed credentials without automatic paid retries or switching providers", async () => {
    vi.stubEnv("AIRROI_API_KEY", "test-secret");
    const request = vi.fn().mockResolvedValue(new Response("secret provider error", { status: 403 }));
    vi.stubGlobal("fetch", request);
    await expect(fetchAirroiEstimate(input)).rejects.toThrow("credit balance");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("reuses widget data for a report without charging or changing the provider snapshot", async () => {
    vi.stubEnv("AIRROI_API_KEY", "test-secret");
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { headers: { "x-request-id": "original" } }));
    vi.stubGlobal("fetch", request);
    const { property_type: ignoredType, suburb: ignoredSuburb, ...widgetInput } = input;
    void ignoredType; void ignoredSuburb;
    const first = await fetchAirroiEstimate(widgetInput);
    const snapshot = structuredClone(first);
    first.enrichment.selected_comp_ids = [];
    first.estimate.annualRevenue = 1;
    const report = await fetchAirroiEstimate(input);
    expect(request).toHaveBeenCalledTimes(1);
    expect(report.enrichment).toMatchObject({ cost_cents: 0, cache_status: "hit", fetched_at: snapshot.enrichment.fetched_at, request_id: "original" });
    expect(report.estimate.annualRevenue).toBe(snapshot.estimate.annualRevenue);
    expect(report.enrichment.comps).toHaveLength(1);
    expect(report.estimate.raw).toMatchObject({ fetched_at: snapshot.enrichment.fetched_at, input, response: payload });
  });
  it("does not cache malformed provider results", async () => {
    vi.stubEnv("AIRROI_API_KEY", "test-secret");
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...payload, revenue: -1 })));
    vi.stubGlobal("fetch", request);
    await expect(fetchAirroiEstimate(input)).rejects.toThrow();
    expect(cache.rpc.mock.calls.map(([name]) => name)).toEqual(["claim_airroi_calculator_cache", "fail_airroi_calculator_cache"]);
    expect(request).toHaveBeenCalledOnce();
  });
});

it("accepts native USD for US estimates and rejects AUD instead of relabelling it", () => {
  const us = { ...input, latitude: 34.080734, longitude: -118.37964, currency: "USD" as const };
  expect(normaliseAirroiResponse({ ...payload, currency: "USD" }, us).enrichment.currency).toBe("USD");
  expect(() => normaliseAirroiResponse(payload, us)).toThrow(/currency/);
});
