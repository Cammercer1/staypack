import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Mimic successful Next Data Cache entries; failures are deliberately not cached.
const shared = vi.hoisted(() => new Map<string, unknown>());
vi.mock("next/cache", () => ({ unstable_cache: (load: () => Promise<unknown>, parts: string[]) => async () => {
  const key = JSON.stringify(parts);
  if (shared.has(key)) return structuredClone(shared.get(key));
  const value = await load();
  shared.set(key, structuredClone(value));
  return value;
} }));
beforeEach(() => shared.clear());
import { fetchAirroiMarketOccupancy, normaliseMarketOccupancy, resolveCoordinateOccupancyMarket } from "./marketOccupancy";

const market = { country: "Australia", region: "New South Wales", locality: "Sydney" };
const input = { latitude: -33.90836, longitude: 151.22473, bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: "Apartment" };
const listing = { suburb: "Kensington", state: "NSW", country: "AU" };
const resolution = { ...market, district: "Kensington" };
const row = (date: string) => ({ date, avg: .55, p25: .25, p50: .58, p75: .79, p90: .9 });
const response = { market, results: Array.from({ length: 13 }, (_, index) => row(new Date(Date.UTC(2025, 8 + index, 1)).toISOString().slice(0, 10))) };
const now = new Date("2026-10-10T00:00:00Z");
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("AirROI market occupancy", () => {
  it("uses the coordinate market while validating country and state instead of requiring an exact suburb alias", () => {
    expect(resolveCoordinateOccupancyMarket(resolution, listing)).toEqual(market);
    expect(resolveCoordinateOccupancyMarket(resolution, { ...listing, suburb: "Liberty Grove" })).toEqual(market);
    expect(() => resolveCoordinateOccupancyMarket(resolution, { ...listing, state: "QLD" })).toThrow("different country or state");
    expect(() => resolveCoordinateOccupancyMarket({ ...resolution, country: "United States" }, listing)).toThrow("different country or state");
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
    fetcher.mockResolvedValueOnce(new Response("No market data", { status: 404 })).mockResolvedValueOnce(new Response("No market data", { status: 404 }));
    const result = await fetchAirroiMarketOccupancy({ ...input, bedrooms: 5 }, listing, saved);
    expect(result.status).toBe("unavailable"); expect(result.months).toEqual([]);
    expect(result.warnings[0]).toContain("no occupancy history");
    expect(result).toMatchObject({ cost_cents: 20, filters: { room_type: { eq: "entire_home" }, bedrooms: { eq: 5 } } });
    expect(result.filters).not.toHaveProperty("listing_type");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("remembers exhausted narrow and broad cohorts without repeating paid requests for seven days", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(new Response("No market data", { status: 404 })).mockResolvedValueOnce(new Response("No market data", { status: 404 }));
    vi.stubGlobal("fetch", fetcher);
    const saved = await fetchAirroiMarketOccupancy(input, listing);
    expect(saved).toMatchObject({ status: "unavailable", unavailable_reason: "insufficient_data", cost_cents: 21, months: [], benchmark_scope: "all_property_types" });
    expect(fetcher).toHaveBeenCalledTimes(3);
    vi.setSystemTime(new Date("2026-10-16T00:00:00Z"));
    const reused = await fetchAirroiMarketOccupancy(input, listing, saved);
    expect(reused).toEqual({ ...saved, cost_cents: 0 });
    expect(fetcher).toHaveBeenCalledTimes(3);
    // Reuse must not reset the expiry, otherwise an empty market never gets rechecked.
    vi.setSystemTime(new Date("2026-10-18T00:00:00Z"));
    fetcher.mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json(response));
    const refreshed = await fetchAirroiMarketOccupancy(input, listing, reused);
    expect(refreshed.status).toBe("available");
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it("allows a later refresh after a transient failure instead of caching it as an empty market", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const failed = await fetchAirroiMarketOccupancy(input, listing);
    expect(failed.status).toBe("unavailable");
    expect(failed.unavailable_reason).toBe("request_failed");
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockResolvedValueOnce(Response.json(response));
    expect((await fetchAirroiMarketOccupancy(input, listing, failed)).status).toBe("available");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

it("gets Liberty Grove duplex history by coordinates in two calls, even after the old suburb-name failure", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-private-key");
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ...market, district: "Liberty Grove" })).mockResolvedValueOnce(Response.json(response));
  vi.stubGlobal("fetch", fetcher);
  const wiltshire = { ...input, latitude: -33.84468, longitude: 151.08489, property_type: "Duplex" };
  const saved = await fetchAirroiMarketOccupancy(wiltshire, { ...listing, suburb: "Liberty Grove" }, {
    status: "unavailable", market: null, label: "Market occupancy unavailable", filters: {}, months: [], sample_count: null,
    request_key: "old-suburb-search", fetched_at: now.toISOString(), cost_cents: 1,
    warnings: ["The market location could not be resolved unambiguously."],
  });
  expect(String(fetcher.mock.calls[0][0])).toBe("https://api.airroi.com/markets/lookup?lat=-33.84468&lng=151.08489");
  expect(fetcher.mock.calls.some(([url]) => String(url).includes("/search"))).toBe(false);
  expect(saved).toMatchObject({ status: "available", cost_cents: 11, filters: { bedrooms: { eq: 3 }, listing_type: { eq: "Entire home" } } });
  expect(saved.months).toHaveLength(12);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("shares verified history across properties while retaining each report's location and original fetch date", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-private-key");
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json(response));
  vi.stubGlobal("fetch", fetcher);
  const first = await fetchAirroiMarketOccupancy(input, listing);
  vi.setSystemTime(new Date("2026-10-10T01:00:00Z"));
  fetcher.mockResolvedValueOnce(Response.json({ ...resolution, district: "Different suburb" }));
  const second = await fetchAirroiMarketOccupancy({ ...input, latitude: -33.89 }, { ...listing, suburb: "Different suburb" });
  expect(second).toMatchObject({ status: "available", market, cost_cents: 1, fetched_at: first.fetched_at });
  expect(second.request_key).not.toBe(first.request_key);
  expect(second.months).toEqual(first.months);
  expect(second.raw).toMatchObject({ resolution: { district: "Different suburb" }, response_status: 200 });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect((await fetchAirroiMarketOccupancy(input, listing)).cost_cents).toBe(0);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it("keeps shared history separate by resolved market, bedrooms and property type", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
  const otherMarket = { ...market, locality: "Sydney Olympic Park" };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json(response))
    .mockResolvedValueOnce(Response.json(otherMarket)).mockResolvedValueOnce(Response.json({ ...response, market: otherMarket }))
    .mockResolvedValueOnce(Response.json(response)).mockResolvedValueOnce(Response.json(response));
  vi.stubGlobal("fetch", fetcher);
  await fetchAirroiMarketOccupancy(input, listing);
  expect((await fetchAirroiMarketOccupancy({ ...input, latitude: -33.84468 }, listing)).market).toEqual(otherMarket);
  expect((await fetchAirroiMarketOccupancy({ ...input, bedrooms: 4 }, listing)).cost_cents).toBe(10);
  expect((await fetchAirroiMarketOccupancy({ ...input, property_type: "Duplex" }, listing)).cost_cents).toBe(10);
  expect(fetcher).toHaveBeenCalledTimes(6);
});

it("retains invalid lookup payloads for diagnosis without calling history or caching a bad market", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-private-key");
  const wrongMarket = { ...market, region: "Victoria", locality: "Melbourne" };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(wrongMarket));
  vi.stubGlobal("fetch", fetcher);
  const failed = await fetchAirroiMarketOccupancy(input, listing);
  expect(failed).toMatchObject({ status: "unavailable", unavailable_reason: "market_resolution_failed", market: null, cost_cents: 1,
    raw: { resolution_status: 200, resolution: wrongMarket } });
  expect(fetcher).toHaveBeenCalledOnce();
  fetcher.mockResolvedValueOnce(Response.json({ error: "test-private-key" }, { status: 503 }));
  const retry = await fetchAirroiMarketOccupancy(input, listing, failed);
  expect(retry.raw).toMatchObject({ resolution_status: 503, resolution: { error: "[redacted]" } });
  expect(JSON.stringify(retry)).not.toContain("test-private-key");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("retains malformed occupancy responses and retries only the failed series on a later estimate", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
  const malformed = { market, results: [row("2025-01-01")] };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json(malformed));
  vi.stubGlobal("fetch", fetcher);
  const failed = await fetchAirroiMarketOccupancy(input, listing);
  expect(failed).toMatchObject({ unavailable_reason: "invalid_data", raw: { response_status: 200, response: malformed } });
  fetcher.mockResolvedValueOnce(Response.json(response));
  expect((await fetchAirroiMarketOccupancy(input, listing, failed)).status).toBe("available");
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it("shares confirmed empty narrow and broad cohorts across properties without repeating either history request", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(new Response("No market data", { status: 404 }))
    .mockResolvedValueOnce(new Response("No market data", { status: 404 }))
    .mockResolvedValueOnce(Response.json(resolution));
  vi.stubGlobal("fetch", fetcher);
  await fetchAirroiMarketOccupancy(input, listing);
  expect(await fetchAirroiMarketOccupancy({ ...input, latitude: -33.89 }, listing)).toMatchObject({ cost_cents: 1, unavailable_reason: "insufficient_data" });
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it.each([404, 200])("broadens an empty duplex cohort (%s) once, retaining bedrooms, whole-property stays and verified geography", async (status) => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
  const empty = status === 404 ? new Response("No market data", { status }) : Response.json({ market, results: [] });
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(empty).mockResolvedValueOnce(Response.json(response));
  vi.stubGlobal("fetch", fetcher);
  const duplex = { ...input, property_type: "Duplex" };
  const result = await fetchAirroiMarketOccupancy(duplex, listing);
  expect(result).toMatchObject({ status: "available", cost_cents: 21, benchmark_scope: "all_property_types", label: "Sydney · 3-bed entire homes · all property types" });
  expect(result.months).toHaveLength(12);
  const narrow = JSON.parse(fetcher.mock.calls[1][1].body);
  const broad = JSON.parse(fetcher.mock.calls[2][1].body);
  expect(narrow.filter.listing_type).toEqual({ eq: "Entire home" });
  expect(broad).toEqual({ market, filter: { room_type: { eq: "entire_home" }, bedrooms: { eq: 3 } }, num_months: 13, currency: "native" });
  expect(result.filters).toEqual(broad.filter);
  expect(result.raw).toMatchObject({ attempts: [{ request: narrow, response_status: status }, { request: broad, response_status: 200, response }] });
  expect(result.warnings.join(" ")).toContain("does not change the property revenue estimate");
  expect((await fetchAirroiMarketOccupancy(duplex, listing, result)).cost_cents).toBe(0);
  expect((await fetchAirroiMarketOccupancy(duplex, listing)).cost_cents).toBe(0);
  expect(fetcher).toHaveBeenCalledTimes(3);
  // A different property type can reuse the broad series after its own narrow cohort is empty.
  fetcher.mockResolvedValueOnce(new Response("No market data", { status: 404 }));
  expect(await fetchAirroiMarketOccupancy(input, listing)).toMatchObject({ status: "available", cost_cents: 10, benchmark_scope: "all_property_types" });
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it("does not repeat a broad request when an unknown property type already starts with all types", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(new Response("No market data", { status: 404 }));
  vi.stubGlobal("fetch", fetcher);
  const result = await fetchAirroiMarketOccupancy({ ...input, property_type: undefined }, listing);
  expect(result).toMatchObject({ cost_cents: 11, unavailable_reason: "insufficient_data", benchmark_scope: "all_property_types" });
  expect(result.filters).not.toHaveProperty("listing_type");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("does not broaden malformed or wrong-market empty responses", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json({ results: [] }));
  vi.stubGlobal("fetch", fetcher);
  expect(await fetchAirroiMarketOccupancy(input, listing)).toMatchObject({ cost_cents: 11, unavailable_reason: "invalid_data" });
  expect(fetcher).toHaveBeenCalledTimes(2);
  fetcher.mockResolvedValueOnce(Response.json({ market: { ...market, locality: "Melbourne" }, results: [] }));
  expect(await fetchAirroiMarketOccupancy(input, listing)).toMatchObject({ cost_cents: 10, unavailable_reason: "invalid_data" });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it("stops after a broader request fails and reuses the narrow empty result on a later estimate", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(new Response("No market data", { status: 404 }))
    .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  const failed = await fetchAirroiMarketOccupancy(input, listing);
  expect(failed).toMatchObject({ cost_cents: 21, unavailable_reason: "request_failed", benchmark_scope: "all_property_types", raw: { response_status: 503 } });
  expect(fetcher).toHaveBeenCalledTimes(3);
  fetcher.mockResolvedValueOnce(Response.json(response));
  const recovered = await fetchAirroiMarketOccupancy(input, listing, failed);
  expect(recovered).toMatchObject({ status: "available", cost_cents: 10, benchmark_scope: "all_property_types" });
  expect(JSON.parse(fetcher.mock.calls[3][1].body).filter).not.toHaveProperty("listing_type");
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it("coalesces overlapping calls in the same worker and attributes provider costs once", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("AIRROI_API_KEY", "test-key");
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(resolution)).mockResolvedValueOnce(Response.json(response));
  vi.stubGlobal("fetch", fetcher);
  const results = await Promise.all([fetchAirroiMarketOccupancy(input, listing), fetchAirroiMarketOccupancy(input, listing)]);
  expect(results.every((result) => result.status === "available")).toBe(true);
  expect(results.reduce((sum, result) => sum + result.cost_cents, 0)).toBe(11);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
