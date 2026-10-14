import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("./client", () => ({ fetchUsPropertyData: vi.fn() }));
import { fetchUsPropertyData } from "./client";
import { discoverUsComparables, normaliseUsComparables } from "./comparables";
import { normaliseUsProperty } from "./normalise";
import property from "./fixtures/west-hollywood.json";
import { enrichUsAppraisal } from "./enrich";
import { orderLeaseAppraisalCompPool, defaultSelectedCompListingIds } from "@/lib/lease-appraisal/leaseAppraisalData";
import { orderSalesAppraisalCompPool, defaultSelectedSaleCompListingIds } from "@/lib/sales-appraisal/salesAppraisalData";

const now = new Date("2026-10-14T12:00:00Z").getTime();
const subject = normaliseUsProperty(property).parsed;
const row = (id: number, changes: Record<string, unknown> = {}) => ({
  zpid: String(id), currency: "USD", country: "USA", streetAddress: `${id} Example Dr`,
  city: "Los Angeles", state: "CA", zipcode: "90069", homeStatus: "FOR_RENT", homeType: "SINGLE_FAMILY",
  bedrooms: 2, bathrooms: 2, livingArea: 1120, latitude: 34.081, longitude: -118.379,
  price: 6200, detailUrl: `https://www.zillow.com/homedetails/${id}_zpid/`, ...changes,
});
const page = (start: number, count: number, changes = {}) => Array.from({ length: count }, (_, i) => row(start + i, changes));
beforeEach(() => { vi.mocked(fetchUsPropertyData).mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

it("crosses ZIP boundaries within the radius, while excluding the subject, duplicates and incompatible homes", () => {
  const result = normaliseUsComparables([
    row(1), row(1), row(2, { streetAddress: "1 Example Drive" }),
    row(3, { latitude: 35 }), row(4, { latitude: null }), row(5, { homeType: "CONDO" }),
    row(6, { bedrooms: 3 }), row(7, { bathrooms: 5 }), row(8, { livingArea: 3500 }),
    row(9, { homeStatus: "FOR_SALE" }), row(10, { currency: "AUD" }),
    row(11, { isRoomForRent: true }), row(12, { shouldShowZestimateAsPrice: true }),
    row(13, { streetAddress: "545 Westbourne Drive" }), row(Number(property.zpid)),
    row(14, { state: "FL" }), row(15, { isUndisclosedAddress: true }),
  ], subject, "lease", now, 1);
  expect(result.map((c) => c.zpid)).toEqual(["1"]);
  expect(result[0].match.distanceMiles).toBeLessThan(1);
});

it("ranks closer, similar-sized homes higher without favouring a target price", () => {
  const ranked = normaliseUsComparables([row(1, { latitude: 34.11 }), row(2, { livingArea: 1900 }), row(3), row(4, { livingArea: null, bathrooms: null })], subject, "lease", now);
  expect(ranked[0].zpid).toBe("3");
  expect(ranked.find((c) => c.zpid === "4")!.match.notes).toContain("Floor area unavailable");
  const expensive = normaliseUsComparables([row(3, { price: 50000 })], subject, "lease", now);
  expect(expensive[0].match.score).toBe(ranked[0].match.score);
});

it("uses only dated sold prices in the last 12 months and prefers recent sales", () => {
  const sold = { homeStatus: "RECENTLY_SOLD", price: 1500000, dateSold: now - 86400000 };
  const result = normaliseUsComparables([row(1, { ...sold, dateSold: now - 200 * 86400000 }), row(2, sold),
    row(3, { ...sold, dateSold: now + 86400000 }), row(4, { ...sold, dateSold: null }),
    row(5, { ...sold, dateSold: now - 400 * 86400000 }), row(6, { ...sold, homeStatus: "FOR_SALE" }),
    row(7, { ...sold, dateSold: (now - 86400000) / 1000 }),
  ], subject, "sales", now);
  expect(result.map((c) => c.zpid)).toEqual(["2", "7", "1"]);
  expect(result[2].match.notes).toContain("Sold more than six months ago");
});

it.each(["lease", "sales"] as const)("paginates only the selected %s category, deduplicates and caps a ranked pool at 30", async (kind) => {
  const status = kind === "lease" ? { homeStatus: "FOR_RENT" } : { homeStatus: "RECENTLY_SOLD", dateSold: Date.now() - 86400000 };
  vi.mocked(fetchUsPropertyData).mockResolvedValueOnce([...page(1, 10, status), ...page(101, 31, { ...status, bedrooms: 3 })])
    .mockResolvedValueOnce([...page(1, 5, status), ...page(11, 25, status)]);
  const { comps, search } = await discoverUsComparables(subject, kind);
  expect(comps).toHaveLength(30);
  expect(new Set(comps.map((c) => c.zpid)).size).toBe(30);
  expect(search).toMatchObject({ requestCount: 2, radiusMiles: 1, returnedCount: 30, targetMet: true, stopReason: "target_met" });
  expect(search.rawComparables).toHaveLength(30);
  expect(fetchUsPropertyData).toHaveBeenNthCalledWith(2, "search-coordinates", expect.objectContaining({ diameter: "2", page: "2", home_status: status.homeStatus }), expect.any(Object));
  expect(vi.mocked(fetchUsPropertyData).mock.calls.every(([, params]) => params.home_status === status.homeStatus)).toBe(true);
});

it("widens the radius only when needed and accepts a 20–24 candidate pool without another area", async () => {
  vi.mocked(fetchUsPropertyData).mockResolvedValueOnce(page(1, 3)).mockResolvedValueOnce(page(1, 22, { latitude: 34.11 }));
  const { comps, search } = await discoverUsComparables(subject, "lease");
  expect(comps).toHaveLength(22);
  expect(search).toMatchObject({ requestCount: 2, radiusMiles: 3, targetMet: true });
  expect(fetchUsPropertyData).toHaveBeenNthCalledWith(2, "search-coordinates", expect.objectContaining({ diameter: "6", page: "1" }), expect.any(Object));
});

it("does not stop on overlap from a smaller search area before reading the next page", async () => {
  const fullPage = [...page(1, 4), ...page(101, 37, { bedrooms: 3 })];
  vi.mocked(fetchUsPropertyData).mockResolvedValueOnce(fullPage).mockResolvedValueOnce([])
    .mockResolvedValueOnce(fullPage).mockResolvedValueOnce(page(5, 24, { latitude: 34.11 }));
  const { comps, search } = await discoverUsComparables(subject, "lease");
  expect(comps).toHaveLength(28);
  expect(search.requestCount).toBe(4);
});

it("keeps earlier matches and stops calls when a later page fails", async () => {
  vi.mocked(fetchUsPropertyData).mockResolvedValueOnce([...page(1, 4), ...page(101, 37, { bedrooms: 3 })]).mockRejectedValueOnce(new Error("quota"));
  const { comps, search } = await discoverUsComparables(subject, "lease");
  expect(comps).toHaveLength(4);
  expect(search).toMatchObject({ requestCount: 2, stopReason: "request_failed", targetMet: false });
});

it("bounds repeated pages and sparse-market requests without padding with wrong-bedroom homes", async () => {
  vi.mocked(fetchUsPropertyData).mockResolvedValue([...page(1, 1), ...page(101, 40, { bedrooms: 3 })]);
  const { comps, search } = await discoverUsComparables(subject, "lease");
  expect(comps).toHaveLength(1);
  expect(search.requestCount).toBe(6);
  expect(search.stopReason).toBe("coverage_limit");
});

it("limits missing-coordinate searches to the subject ZIP and never uses a mismatched profile's location", async () => {
  const missing = { ...subject, usProperty: { ...subject.usProperty!, address: { ...subject.usProperty!.address, streetAddress: "999 Wrong St" } } };
  vi.mocked(fetchUsPropertyData).mockResolvedValue([row(1, { zipcode: "90048", latitude: null, longitude: null }), row(2)]);
  const { comps, search } = await discoverUsComparables(missing, "lease");
  expect(comps.map((c) => c.zpid)).toEqual(["1"]);
  expect(search.radiusMiles).toBeUndefined();
  expect(fetchUsPropertyData).toHaveBeenCalledWith("search", expect.objectContaining({ location: "90048" }), expect.any(Object));
  expect(comps[0].match.notes).toContain("Distance unavailable; same ZIP code");
});

it("stops at the overall time budget and retains returned evidence", async () => {
  let elapsed = 0;
  vi.spyOn(Date, "now").mockImplementation(() => now + elapsed);
  vi.mocked(fetchUsPropertyData).mockImplementation(async () => { elapsed += 61000; return [...page(1, 4), ...page(101, 37, { bedrooms: 3 })]; });
  const { comps, search } = await discoverUsComparables(subject, "lease");
  expect(comps).toHaveLength(4);
  expect(search).toMatchObject({ requestCount: 1, stopReason: "time_limit" });
});

it.each(["lease", "sales"] as const)("preserves US ranking in the %s review pool and six default report selections", async (kind) => {
  vi.mocked(fetchUsPropertyData).mockResolvedValue(page(1, 30, kind === "sales" ? { homeStatus: "RECENTLY_SOLD", dateSold: Date.now() - 86400000 } : {}));
  const enriched = await enrichUsAppraisal(subject, kind);
  const comps = kind === "lease" ? enriched.rentalComps! : enriched.salesComps!;
  comps[0].usMatch!.score = 1;
  comps[29].usMatch!.score = 100;
  const ordered = kind === "lease" ? orderLeaseAppraisalCompPool(enriched) : orderSalesAppraisalCompPool(enriched);
  expect(ordered).toHaveLength(30);
  expect(ordered[0].listingUrl).toBe(comps[29].listingUrl);
  const ids = kind === "lease" ? defaultSelectedCompListingIds(enriched) : defaultSelectedSaleCompListingIds(enriched);
  expect(ids).toHaveLength(6);
  expect(ids[0]).toBe(comps[29].listingUrl);
});
