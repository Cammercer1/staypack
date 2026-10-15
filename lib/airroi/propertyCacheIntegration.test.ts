import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  rpc: (...args: unknown[]) => ({ abortSignal: () => database.rpc(...args) }),
}) }));

import { fetchAirroiEstimate } from "./client";
import { AIRROI_CACHE_TTL_MS } from "./estimateCache";
import { airroiPropertyKey } from "./propertyIdentity";
import { calculatorLeadAddress } from "@/lib/str-calculator/leadAddress";

const property = { property_address: "18/8-12 Ascot Street", suburb: "Kensington", state: "NSW", postcode: "2033", country: "Australia" };
const propertyKey = airroiPropertyKey(property)!;
const input = {
  latitude: -33.90836, longitude: 151.22473, bedrooms: 3, bathrooms: 1.5,
  accommodates: 6, radiusM: 2000, currency: "AUD" as const,
};
const shiftedInput = { ...input, latitude: -33.90848, longitude: 151.22486 };
const response = {
  currency: "AUD", revenue: 63638.64, occupancy: 0.56, average_daily_rate: 318,
  percentiles: {
    revenue: { p25: 36000, p50: 60000, p75: 82000, p90: 108000 },
    occupancy: { p25: 0.39, p50: 0.58, p75: 0.73, p90: 0.82 },
    average_daily_rate: { p25: 225, p50: 293, p75: 380, p90: 492 },
  },
  monthly_revenue_distributions: Array.from({ length: 12 }, () => 1 / 12),
  comparable_listings: [{
    listing_info: {
      listing_id: "906067906063315896", listing_name: "Comparable apartment",
      listing_type: "Entire rental unit", room_type: "entire_home",
      cover_photo_url: "https://images.example.com/photo.jpg",
    },
    location_info: { latitude: -33.9084, longitude: 151.2248, locality: "Kensington" },
    property_details: { bedrooms: 3, baths: 1.5, guests: 6 },
    performance_metrics: { ttm_revenue: 80000, ttm_occupancy: 0.6, ttm_avg_rate: 350 },
  }],
};

type CacheRow = {
  request_key: string;
  property_key?: string;
  configuration_key?: string;
  provider_input?: typeof input;
  response?: unknown;
  request_id?: string | null;
  fetched_at?: string;
  expires_at?: string;
};

/** The database matcher itself is tested against PostgreSQL, not reproduced here. */
function installDatabaseFixture() {
  const rows = new Map<string, CacheRow>();
  database.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    const requestKey = args.p_request_key as string;
    if (name === "claim_airroi_property_calculator_cache" || name === "claim_airroi_calculator_cache") {
      const propertyRequest = name === "claim_airroi_property_calculator_cache";
      const row = propertyRequest
        ? [...rows.values()].find(candidate => candidate.property_key === args.p_property_key &&
          candidate.configuration_key === args.p_configuration_key)
        : rows.get(requestKey);
      if (row?.response) return { data: { status: "hit", ...structuredClone(row) }, error: null };
      const reservation: CacheRow = {
        request_key: requestKey,
        ...(propertyRequest ? {
          property_key: args.p_property_key as string,
          configuration_key: args.p_configuration_key as string,
          provider_input: structuredClone(args.p_input) as typeof input,
        } : {}),
      };
      rows.set(requestKey, reservation);
      return { data: { status: "claimed", ...reservation }, error: null };
    }
    if (name === "complete_airroi_calculator_cache") {
      const row = rows.get(requestKey);
      if (!row) throw new Error("Completion must use the reserved cache key");
      const timestamps = {
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + AIRROI_CACHE_TTL_MS).toISOString(),
      };
      rows.set(requestKey, { ...row, ...timestamps, response: structuredClone(args.p_response), request_id: args.p_request_id as string | null });
      return { data: timestamps, error: null };
    }
    if (name === "fail_airroi_calculator_cache") return { data: true, error: null };
    throw new Error(`Unexpected RPC ${name}`);
  });
}

let provider: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("AIRROI_API_KEY", "test-provider-key");
  database.rpc.mockReset();
  installDatabaseFixture();
  provider = vi.fn(async () => new Response(JSON.stringify(response), { headers: { "x-request-id": "original-provider-request" } }));
  vi.stubGlobal("fetch", provider);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("property-aware calculator cache through the provider adapter", () => {
  it.each(["report first", "widget first"])("reuses one provider result with slightly different coordinates: %s", async (order) => {
    const reportInput = { ...input, property_type: "Apartment", suburb: "Kensington" };
    const widgetKey = airroiPropertyKey({
      ...calculatorLeadAddress("18/8-12 Ascot St, Kensington NSW 2033, Australia", "AU"), country: "AU",
    });
    expect(widgetKey).toBe(propertyKey);
    const [firstInput, secondInput] = order === "report first" ? [reportInput, shiftedInput] : [shiftedInput, reportInput];
    const [firstKey, secondKey] = order === "report first" ? [propertyKey, widgetKey] : [widgetKey, propertyKey];
    const first = await fetchAirroiEstimate(firstInput, firstKey);
    const original = structuredClone(first);
    // A report's manual changes must not leak into the next agency's result.
    first.estimate.annualRevenue = 1;
    first.enrichment.selected_comp_ids = [];
    const reused = await fetchAirroiEstimate(secondInput, secondKey);

    expect(provider).toHaveBeenCalledOnce();
    expect(provider.mock.calls[0][0].pathname).toBe("/calculator/estimate");
    expect(reused.estimate.annualRevenue).toBe(original.estimate.annualRevenue);
    expect(reused.enrichment.comps.map(comp => comp.listing_id)).toEqual(["906067906063315896"]);
    expect(reused.enrichment).toMatchObject({
      cache_status: "hit", cost_cents: 0, fetched_at: original.enrichment.fetched_at,
      request_id: "original-provider-request", cache_key: original.enrichment.cache_key,
    });
    expect(reused.estimate.raw).toMatchObject({
      input: { latitude: firstInput.latitude, longitude: firstInput.longitude },
      requested_input: { latitude: secondInput.latitude, longitude: secondInput.longitude },
      response, fetched_at: original.enrichment.fetched_at,
    });
    expect(database.rpc.mock.calls.filter(([name]) => name === "complete_airroi_calculator_cache")).toHaveLength(1);
    const claim = database.rpc.mock.calls.find(([name]) => name === "claim_airroi_property_calculator_cache")?.[1];
    expect(claim).toMatchObject({ p_property_key: propertyKey,
      p_input: { ...input, latitude: firstInput.latitude, longitude: firstInput.longitude },
      p_configuration_key: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(JSON.stringify(reused)).not.toContain("test-provider-key");
  });

  it.each([
    { label: "bedrooms", changes: { bedrooms: 4 } },
    { label: "bathrooms", changes: { bathrooms: 2 } },
    { label: "guest capacity", changes: { accommodates: 8 } },
    { label: "search radius", changes: { radiusM: 3000 } },
  ])("makes a fresh provider call when $label differs", async ({ changes }) => {
    await fetchAirroiEstimate(input, propertyKey);
    const changed = await fetchAirroiEstimate({ ...shiftedInput, ...changes }, propertyKey);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(changed.enrichment).toMatchObject({ cache_status: "miss", cost_cents: 20 });
  });

  it("does not reuse a response from a different currency", async () => {
    await fetchAirroiEstimate(input, propertyKey);
    provider.mockImplementation(async () => new Response(JSON.stringify({ ...response, currency: "USD" })));
    const changed = await fetchAirroiEstimate({ ...shiftedInput, currency: "USD" }, propertyKey);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(changed.enrichment).toMatchObject({ currency: "USD", cache_status: "miss" });
  });

  it.each([
    { label: "another unit", address: "19/8-12 Ascot Street" },
    { label: "the neighbouring property", address: "18/14 Ascot Street" },
  ])("does not share even identical coordinates with $label", async ({ address }) => {
    const otherKey = airroiPropertyKey({ ...property, property_address: address });
    expect(otherKey).toMatch(/^[a-f0-9]{64}$/);
    expect(otherKey).not.toBe(propertyKey);
    await fetchAirroiEstimate(input, propertyKey);
    const distinct = await fetchAirroiEstimate(input, otherKey);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(distinct.enrichment.cache_status).toBe("miss");
  });

  it("keeps exact-coordinate matching when no reliable property identity exists", async () => {
    await fetchAirroiEstimate(input, null);
    await fetchAirroiEstimate(input, null);
    await fetchAirroiEstimate(shiftedInput, null);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(database.rpc.mock.calls.some(([name]) => name === "claim_airroi_property_calculator_cache")).toBe(false);
  });

  it.each([
    { label: "different bedrooms", mismatch: { bedrooms: 4 } },
    { label: "different bathrooms", mismatch: { bathrooms: 2 } },
    { label: "different guest capacity", mismatch: { accommodates: 8 } },
    { label: "distant coordinates", mismatch: { latitude: input.latitude + 0.01 } },
  ])("rejects an invalid cache hit with $label without making a provider call", async ({ mismatch }) => {
    database.rpc.mockResolvedValue({ data: {
      status: "hit", request_key: "c".repeat(64), provider_input: { ...input, ...mismatch },
      response, request_id: "original-provider-request", fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + AIRROI_CACHE_TTL_MS).toISOString(),
    }, error: null });
    await expect(fetchAirroiEstimate(input, propertyKey)).rejects.toThrow();
    expect(provider).not.toHaveBeenCalled();
  });
});
