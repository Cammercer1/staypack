import { beforeEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
const mocks = vi.hoisted(() => ({ occupancy: vi.fn(), estimate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/airroi/marketOccupancy", () => ({ fetchAirroiMarketOccupancy: mocks.occupancy }));
vi.mock("@/lib/str/estimate", () => ({ fetchStrEstimate: mocks.estimate }));
import { calculatorPropertyReviewKey, estimateForCalculatorReview } from "./propertyReview";
const input = { latitude: -33.9, longitude: 151.2, bedrooms: 2, bathrooms: 1, accommodates: 4, currency: "AUD" as const, radiusM: 2000 };
function fixture() {
  const f = createLintRegressionFixtures();
  const listing = { ...f.listing, property_address: "2/24 Cliffbrook Parade", suburb: "Clovelly", state: "NSW", postcode: "2031", country: "Australia", ...input };
  const report = { ...f.report, original_estimate_json: { ...f.report.original_estimate_json!, raw: { provider: "airroi", input, fetched_at: new Date(Date.now()-86400000).toISOString() } } };
  return { listing, report, key: calculatorPropertyReviewKey(listing) };
}
beforeEach(() => { vi.clearAllMocks(); mocks.occupancy.mockResolvedValue({ status: "available", months: [], cost_cents: 11 }); mocks.estimate.mockResolvedValue({ estimate: {}, enrichment: {} }); });
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
