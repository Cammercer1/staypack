import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAirroiMarketOccupancy, normaliseMarketOccupancy, resolveOccupancyMarket } from "./marketOccupancy";

const market = { country: "Australia", region: "New South Wales", locality: "Sydney" };
const input = { latitude: -33.90836, longitude: 151.22473, bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: "Apartment" };
const listing = { suburb: "Kensington", state: "NSW", country: "AU" };
const resolution = { entries: [
  { ...market, region: "Victoria", locality: "Melbourne", district: "Kensington" },
  { ...market, locality: "Kensington", district: "" },
  { ...market, district: "Kensington" },
] };
const row = (date: string) => ({ date, avg: .55, p25: .25, p50: .58, p75: .79, p90: .9 });
const response = { market, results: Array.from({ length: 13 }, (_, index) => row(new Date(Date.UTC(2025, 8 + index, 1)).toISOString().slice(0, 10))) };
const now = new Date("2026-10-10T00:00:00Z");
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("AirROI market occupancy", () => {
  it("resolves the correct state and enclosing city without broadening bedroom or property-type filters", () => {
    expect(resolveOccupancyMarket(resolution, "Kensington", "New South Wales")).toEqual(market);
    expect(() => resolveOccupancyMarket(resolution, "Kensington", "Queensland")).toThrow();
  });
  it("retains 12 completed months with provider percentiles and excludes incomplete or future months", () => {
    const data = normaliseMarketOccupancy({ ...response, results: [...response.results, row("2026-10-01"), row("2026-11-01")] }, market, now);
    expect(data.months).toHaveLength(12);
    expect(data.months[0]).toMatchObject({ month: "2025-10", p25: 25, p75: 79, p90: 90 });
    expect(data.months[0].average).toBeCloseTo(55);
    expect(data.months[0].p50).toBeCloseTo(58);
    expect(data.months.at(-1)?.month).toBe("2026-09");
  });
  it("does not fill missing months, silently aggregate daily records, accept wrong locations or use stale data", () => {
    const data = normaliseMarketOccupancy({ market, results: [row("2026-07-01"), row("2026-09-01"), row("2026-09-02")] }, market, now);
    expect(data.months.map((r) => r.month)).toEqual(["2026-07", "2026-09"]);
    expect(data.warnings.join(" ")).toContain("missing months are not estimated");
    const withGap = normaliseMarketOccupancy({ ...response, results: response.results.filter((r) => r.date !== "2026-07-01") }, market, now);
    expect(withGap.months).toHaveLength(11);
    expect(withGap.months[0].month).toBe("2025-10");
    expect(() => normaliseMarketOccupancy({ ...response, market: { ...market, locality: "Melbourne" } }, market, now)).toThrow("different market");
    expect(() => normaliseMarketOccupancy({ market, results: [row("2025-01-01")] }, market, now)).toThrow("too old");
    expect(() => normaliseMarketOccupancy({ market, results: [row("2026-09-01"), row("2026-09-01")] }, market, now)).toThrow("Duplicate");
  });
  it("rejects percent-as-fraction and unordered percentile records", () => {
    for (const change of [{ p50: 58 }, { p25: .8 }]) {
      expect(() => normaliseMarketOccupancy({ market, results: [{ ...row("2026-09-01"), ...change }] }, market, now)).toThrow("No valid");
    }
  });
  it("uses one resolution and one series call, then reuses a matched saved benchmark", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-private-key");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json(response));
    vi.stubGlobal("fetch", fetcher);
    const result = await fetchAirroiMarketOccupancy(input, listing);
    expect(result).toMatchObject({ status: "available", cost_cents: 11, market, sample_count: null, label: "Sydney · 3-bed rental units" });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ market, filter: { room_type: { eq: "entire_home" }, bedrooms: { eq: 3 }, listing_type: { eq: "Entire rental unit" } }, num_months: 13, currency: "native" });
    expect(JSON.stringify(result)).not.toContain("test-private-key");
    const reused = await fetchAirroiMarketOccupancy(input, listing, result);
    expect(reused.cost_cents).toBe(0); expect(fetcher).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date("2026-10-18T00:00:00Z"));
    fetcher.mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json(response));
    await fetchAirroiMarketOccupancy(input, listing, result);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("does not reuse history when property inputs change and preserves an explicit unavailable state on failure", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json(response));
    vi.stubGlobal("fetch", fetcher);
    const saved = await fetchAirroiMarketOccupancy(input, listing);
    fetcher.mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(new Response("No market data", { status: 404 }));
    const result = await fetchAirroiMarketOccupancy({ ...input, bedrooms: 5 }, listing, saved);
    expect(result.status).toBe("unavailable"); expect(result.months).toEqual([]);
    expect(result.warnings[0]).toContain("sufficiently large");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("remembers insufficient-data results without widening filters or repeating paid requests for seven days", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(new Response("No market data", { status: 404 }));
    vi.stubGlobal("fetch", fetcher);
    const saved = await fetchAirroiMarketOccupancy(input, listing);
    expect(saved).toMatchObject({ status: "unavailable", unavailable_reason: "insufficient_data", cost_cents: 11, months: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date("2026-10-16T00:00:00Z"));
    const reused = await fetchAirroiMarketOccupancy(input, listing, saved);
    expect(reused).toEqual({ ...saved, cost_cents: 0 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    // Reuse must not reset the expiry, otherwise an empty market never gets rechecked.
    vi.setSystemTime(new Date("2026-10-18T00:00:00Z"));
    fetcher.mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json(response));
    const refreshed = await fetchAirroiMarketOccupancy(input, listing, reused);
    expect(refreshed.status).toBe("available");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("allows a later refresh after a transient failure instead of caching it as an empty market", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const failed = await fetchAirroiMarketOccupancy(input, listing);
    expect(failed.status).toBe("unavailable");
    expect(failed.unavailable_reason).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json(response));
    expect((await fetchAirroiMarketOccupancy(input, listing, failed)).status).toBe("available");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
