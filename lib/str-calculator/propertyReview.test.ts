import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
const mocks = vi.hoisted(() => ({ occupancy: vi.fn(), estimate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/airroi/marketOccupancy", () => ({ fetchAirroiMarketOccupancy: mocks.occupancy }));
vi.mock("@/lib/str/estimate", () => ({ fetchStrEstimate: mocks.estimate }));
import { calculatorPropertyReviewKey, estimateForCalculatorReview } from "./propertyReview";
import { canonicalCalculatorSourceKey, type CanonicalCalculatorLead } from "./leadCanonicalProperty";
const input = { latitude: -33.9, longitude: 151.2, bedrooms: 2, bathrooms: 1, accommodates: 4, currency: "AUD" as const, radiusM: 2000 };
function fixture() {
  const f = createLintRegressionFixtures();
  const listing = { ...f.listing, property_address: "2/24 Cliffbrook Parade", suburb: "Clovelly", state: "NSW", postcode: "2031", country: "Australia", ...input };
  const report = { ...f.report, original_estimate_json: { ...f.report.original_estimate_json!, raw: { provider: "airroi", input, fetched_at: new Date(Date.now()-86400000).toISOString() } } };
  return { listing, report, key: calculatorPropertyReviewKey(listing) };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-16T00:00:00.000Z")); vi.clearAllMocks(); mocks.occupancy.mockResolvedValue({ status: "available", months: [], cost_cents: 11 }); mocks.estimate.mockResolvedValue({ estimate: {}, enrichment: {} }); });
afterEach(() => vi.useRealTimers());
it("keeps the exact baseline and comparable selection after confirmation, fetching only missing occupancy", async () => {
  const f = fixture(); const before = structuredClone(f.report);
  const result = await estimateForCalculatorReview(input, f.listing, f.report, f.key);
  expect(result.reused).toBe(true);
  expect(result.estimate).toEqual(f.report.original_estimate_json);
  expect(result.enrichment.comps).toEqual(before.str_enrichment_json!.comps);
  expect(result.enrichment.comp_pool).toEqual(before.str_enrichment_json!.comp_pool);
  expect(result.enrichment.selected_comp_ids).toEqual(before.str_enrichment_json!.selected_comp_ids);
  expect(mocks.estimate).not.toHaveBeenCalled(); expect(mocks.occupancy).toHaveBeenCalledTimes(1);
  expect(f.report).toEqual(before);
});
it.each([{ bedrooms: 3 }, { bathrooms: 1.5 }, { accommodates: 5 }, { latitude: -33.91 }])("refreshes evidence when confirmed configuration/location changes (%j)", async changes => {
  const f = fixture(); const result = await estimateForCalculatorReview({ ...input, ...changes }, f.listing, f.report, f.key);
  expect(result.reused).toBe(false); expect(mocks.estimate).toHaveBeenCalledTimes(1); expect(mocks.occupancy).not.toHaveBeenCalled();
});
it.each([{ suburb: "Coogee", postcode: "2034" }, { property_address: "1/24 Cliffbrook Parade" }])("does not reuse the original property's baseline after address correction %j", async changes => {
  const f = fixture(); expect((await estimateForCalculatorReview(input, { ...f.listing, ...changes }, f.report, f.key)).reused).toBe(false);
  expect(mocks.estimate).toHaveBeenCalledTimes(1);
});
it("expires the original estimate after 30 days", async () => {
  const f = fixture(); f.report.original_estimate_json.raw.fetched_at = new Date(Date.now()-31*86400000).toISOString();
  expect((await estimateForCalculatorReview(input, f.listing, f.report, f.key)).reused).toBe(false);
});

function canonicalFixture() {
  const f = fixture();
  const raw = { ...f.report.original_estimate_json.raw, response: { revenue: 65322, comparables: [{ id: "original-comparable" }] } };
  f.report.original_estimate_json.raw = raw;
  const lead: CanonicalCalculatorLead = { address: "2/24 Cliffbrook Parade, Coogee NSW 2034", country: "AU", status: "estimated",
    estimate_json: { address: "Unit 2/24 Cliffbrook Parade, Clovelly NSW 2031, Australia" }, original_estimate_json: structuredClone(raw), completed_at: new Date().toISOString() };
  return { ...f, lead };
}

it("reuses the exact original estimate and comparables after a trusted suburb correction, fetching only occupancy", async () => {
  const f = canonicalFixture(); const before = structuredClone(f.report);
  const sourceKey = canonicalCalculatorSourceKey(f.lead, f.report);
  expect(sourceKey).toBe(f.key);
  const result = await estimateForCalculatorReview(input, f.listing, f.report, sourceKey!);
  expect(result.reused).toBe(true);
  expect(result.estimate).toEqual(before.original_estimate_json);
  expect(result.enrichment.comps).toEqual(before.str_enrichment_json!.comps);
  expect(result.enrichment.comp_pool).toEqual(before.str_enrichment_json!.comp_pool);
  expect(result.enrichment.selected_comp_ids).toEqual(before.str_enrichment_json!.selected_comp_ids);
  expect(mocks.estimate).not.toHaveBeenCalled();
  expect(mocks.occupancy).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(input), f.listing, before.str_enrichment_json!.market_occupancy);
  expect(f.report).toEqual(before);
});

it.each([30 * 86400000, 31 * 86400000, -1, NaN])("does not use canonical identity to bypass evidence age checks (%s milliseconds)", async age => {
  const f = canonicalFixture();
  const fetchedAt = Number.isNaN(age) ? "not-a-date" : new Date(Date.now() - age).toISOString();
  f.report.original_estimate_json.raw.fetched_at = fetchedAt;
  f.lead.original_estimate_json = structuredClone(f.report.original_estimate_json.raw);
  const sourceKey = canonicalCalculatorSourceKey(f.lead, f.report);
  expect(sourceKey).toBe(f.key);
  expect((await estimateForCalculatorReview(input, f.listing, f.report, sourceKey!)).reused).toBe(false);
  expect(mocks.estimate).toHaveBeenCalledTimes(1); expect(mocks.occupancy).not.toHaveBeenCalled();
});

it("retains the final millisecond of the original 30-day lifetime after canonical correction", async () => {
  const f = canonicalFixture();
  f.report.original_estimate_json.raw.fetched_at = new Date(Date.now() - 30 * 86400000 + 1).toISOString();
  f.lead.original_estimate_json = structuredClone(f.report.original_estimate_json.raw);
  expect((await estimateForCalculatorReview(input, f.listing, f.report, canonicalCalculatorSourceKey(f.lead, f.report)!)).reused).toBe(true);
  expect(mocks.estimate).not.toHaveBeenCalled();
});

it.each([{ bedrooms: 3 }, { bathrooms: 1.5 }, { accommodates: 5 }])("keeps configuration matching mandatory after canonical correction (%j)", async changed => {
  const f = canonicalFixture(); const sourceKey = canonicalCalculatorSourceKey(f.lead, f.report);
  expect((await estimateForCalculatorReview({ ...input, ...changed }, f.listing, f.report, sourceKey!)).reused).toBe(false);
  expect(mocks.estimate).toHaveBeenCalledTimes(1);
});

it.each([[49, true], [51, false]] as const)("allows coordinate drift only within 50m after canonical correction (%sm)", async (metres, reused) => {
  const f = canonicalFixture();
  const shifted = { ...input, latitude: input.latitude + metres / 6371000 * 180 / Math.PI };
  expect((await estimateForCalculatorReview(shifted, f.listing, f.report, canonicalCalculatorSourceKey(f.lead, f.report)!)).reused).toBe(reused);
  expect(mocks.estimate).toHaveBeenCalledTimes(reused ? 0 : 1);
});

it("does not use canonical identity to reuse a result in a different currency", async () => {
  const f = canonicalFixture();
  Object.assign(f.report.original_estimate_json.raw.input, { currency: "USD" });
  f.lead.original_estimate_json = structuredClone(f.report.original_estimate_json.raw);
  expect((await estimateForCalculatorReview(input, f.listing, f.report, canonicalCalculatorSourceKey(f.lead, f.report)!)).reused).toBe(false);
  expect(mocks.estimate).toHaveBeenCalledTimes(1);
});
