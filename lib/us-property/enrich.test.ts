import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { enrichUsAppraisal, normaliseUsComparables } from "./enrich";
import { normaliseUsProperty } from "./normalise";
import property from "./fixtures/west-hollywood.json";
import { fetchUsPropertyData } from "./client";
vi.mock("./client", () => ({ fetchUsPropertyData: vi.fn() }));
const subject = normaliseUsProperty(property).parsed;
const comp = { zpid: "123", currency: "USD", country: "USA", streetAddress: "551 Westbourne Dr", city: "West Hollywood", state: "CA", zipcode: "90048", latitude: 34.081, longitude: -118.379, homeStatus: "FOR_RENT", homeType: "SINGLE_FAMILY", price: 6200, bedrooms: 2, bathrooms: 2, detailUrl: "https://www.zillow.com/homedetails/123_zpid/" };
afterEach(() => vi.resetAllMocks());
it("excludes wrong currencies, subject, duplicates, distant homes, types and room counts", () => {
  const result = normaliseUsComparables([comp, comp, { ...comp, zpid: "2", zipcode: "90046", latitude: 35 }, { ...comp, zpid: "3", homeType: "CONDO" }, { ...comp, zpid: "4", currency: "AUD" }, { ...comp, zpid: "5", bedrooms: 3 }, { ...comp, zpid: subject.usProperty?.zpid }], subject, "lease");
  expect(result).toHaveLength(1);
});
it("rejects stale solds, future sales and current asking prices as sold evidence", () => {
  const now = Date.now(), sold = { ...comp, homeStatus: "RECENTLY_SOLD", dateSold: now - 86400000 };
  expect(normaliseUsComparables([sold, { ...sold, zpid: "2", dateSold: now + 86400000 }, { ...sold, zpid: "3", dateSold: now - 700 * 86400000 }, { ...sold, zpid: "4", homeStatus: "FOR_SALE" }], subject, "sales", now)).toHaveLength(1);
});
it("uses wider bedroom search bounds, exact local filtering and USD monthly evidence", async () => {
  vi.mocked(fetchUsPropertyData).mockResolvedValue([comp]);
  const result = await enrichUsAppraisal(subject, "lease");
  expect(fetchUsPropertyData).toHaveBeenCalledWith("search-coordinates", expect.objectContaining({ min_bedrooms: "1", max_bedrooms: "3", home_status: "FOR_RENT" }), expect.any(Object));
  expect(result.rentalAppraisal!.weeklyMidpoint! * 52).toBeCloseTo(6269 * 12);
  expect(result.rentalComps![0].weeklyRent * 52).toBeCloseTo(6200 * 12);
  expect(result.domainAvm).toBeUndefined();
});
it("keeps usable estimates and manual fallback when comparable API fails", async () => {
  vi.mocked(fetchUsPropertyData).mockRejectedValue(new Error("quota"));
  const result = await enrichUsAppraisal(subject, "sales");
  expect(result.salesAppraisal?.priceMidpoint).toBe(1584100);
  expect(result.salesComps).toEqual([]);
  expect(result.warnings.join(" ")).toContain("unavailable");
});
