import { beforeEach, expect, it, vi } from "vitest";
import type { ApifyReaListingRecord } from "@/lib/apify/types";
import type { ParsedListing } from "@/lib/types";
import { resolveSelectedRentalComps } from "@/lib/lease-appraisal/leaseAppraisalData";
import { enrichListingRentalAppraisal } from "./enrichListingRentalAppraisal";

const mocks = vi.hoisted(() => ({ search: vi.fn(), position: vi.fn() }));
vi.mock("@/lib/rea/client", () => ({
  getReaMaxListings: () => 100, hasReaDataProviderConfig: () => true,
  scrapeReaSearch: (...args: unknown[]) => mocks.search(...args),
  scrapeReaSearchUrls: (...args: unknown[]) => mocks.search(...args),
}));
vi.mock("@/lib/domain-avm/client", () => ({ enrichListingWithDomainAvm: async (listing: ParsedListing) => ({ listing, status: "cached" }) }));
vi.mock("@/lib/propradar/enrichLtrSuburbMarket", () => ({ enrichLtrSuburbMarket: async (listing: ParsedListing) => ({ listing }) }));
vi.mock("@/lib/lease-appraisal/positionLeaseAppraisal", () => ({ positionLeaseAppraisal: (...args: unknown[]) => mocks.position(...args), subjectFromParsedListing: (listing: ParsedListing) => listing }));

beforeEach(() => {
  mocks.search.mockReset();
  mocks.position.mockReset().mockImplementation(() => { throw new Error("Unexpected positioning request"); });
});

it("selects same-suburb evidence at the enrichment boundary even when the automated guide favours cheaper nearby adverts", async () => {
  const listing: ParsedListing = { country: "AU", address: "2/6 Tower Street", suburb: "Manly", state: "NSW", postcode: "2095",
    bedrooms: 1, bathrooms: 1, propertyType: "apartment", images: [], agents: [], warnings: [], confidence: "high",
    domainAvm: { address: "2/6 Tower Street, Manly", urlSlug: "2-6-tower-street-manly", matchedAt: "2026-10-16T00:00:00Z", comparableSales: [], rentalEstimate: { weeklyRent: 565, confidence: "high" } } };
  const record = (suburb: string, weeklyRent: number, index: number): ApifyReaListingRecord => ({
    channel: "rent", suburb, address: `${index + 1}/20 Test Street`, propertyType: "apartment", bedrooms: 1, bathrooms: 1,
    price: `$${weeklyRent} per week`, url: `https://example.test/${suburb}/${index}`,
  });
  const local = [630, 650, 730, 750, 780, 850, 860, 880].map((rent, index) => record("Manly", rent, index));
  const nearby = [600, 610, 640, 670].map((rent, index) => record("Dee Why", rent, index));
  mocks.search.mockResolvedValue({ provider: "rapidapi", records: [...nearby, ...local] });
  const before = structuredClone(listing);

  const result = await enrichListingRentalAppraisal(listing);
  const selected = resolveSelectedRentalComps(result);

  expect(selected).toHaveLength(6);
  expect(selected.every(comp => comp.suburb === "Manly")).toBe(true);
  expect(selected.map(comp => comp.weeklyRent)).toEqual([630, 650, 730, 750, 780, 850]);
  // Evidence selection does not silently invent a different valuation.
  expect(result.rentalAppraisal).toMatchObject({ weeklyMin: 540, weeklyMidpoint: 565, weeklyMax: 590 });
  expect(mocks.search).toHaveBeenCalledTimes(1);
  expect(mocks.position).not.toHaveBeenCalled();
  expect(listing).toEqual(before);
});
