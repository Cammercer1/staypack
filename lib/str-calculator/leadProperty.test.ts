import { beforeEach, expect, it, vi } from "vitest";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
const mocks = vi.hoisted(() => ({ search: vi.fn(), domain: vi.fn(), us: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/domain-avm/propertyLookup", () => ({ searchDomainProperties: mocks.search, lookupDomainProperty: mocks.domain }));
vi.mock("@/lib/us-property/lookup", () => ({ lookupUsProperty: mocks.us }));
import { lookupCalculatorLeadProperty } from "./leadProperty";
const property = { property_address: "1/24 Test Street", suburb: "Sydney", state: "NSW", postcode: "2000", bedrooms: 2, bathrooms: 1, accommodates: 4 };
const photo = "https://example.com/property.jpg";
const imported = createEmptyListingDraft({ ...property, bedrooms: 4, bathrooms: 3, accommodates: 8, latitude: 1,
  hero_image_url: photo, selected_image_urls: [photo], scraped_listing_json: { agents: [], confidence: "high", warnings: [], images: [photo], domainAvm: { urlSlug: "test", address: property.property_address, comparableSales: [], matchedAt: "2026-10-15T00:00:00Z", rentalEstimate: { weeklyRent: 850, confidence: "medium" } } } });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.search.mockResolvedValue([{ source: "domain", streetAddress: property.property_address, suburb: "Sydney", state: "NSW", postcode: "2000", slug: "test" }]);
  mocks.domain.mockResolvedValue(imported);
  mocks.us.mockResolvedValue(imported);
});
it("imports verified Australian photos and rental evidence without overwriting calculator configuration", async () => {
  const result = await lookupCalculatorLeadProperty(property, "AU");
  expect(result.hero_image_url).toBe(photo);
  expect(result.scraped_listing_json?.domainAvm?.rentalEstimate?.weeklyRent).toBe(850);
  for (const key of ["bedrooms", "bathrooms", "accommodates", "latitude", "longitude"]) expect(result).not.toHaveProperty(key);
  expect(mocks.us).not.toHaveBeenCalled();
});
it("uses Zillow for US leads and preserves the original apartment address", async () => {
  const usProperty = { ...property, property_address: "123 Main St Apt 2", suburb: "Austin", state: "TX", postcode: "78701", country: "United States" };
  mocks.us.mockResolvedValue({ ...imported, ...usProperty });
  await lookupCalculatorLeadProperty(usProperty, "US");
  expect(mocks.us).toHaveBeenCalledWith(expect.objectContaining({ source: "zillow", streetAddress: "123 Main St Apt 2" }));
  expect(mocks.search).not.toHaveBeenCalled();
});
it.each(["AU", "US"] as const)("rejects a different apartment returned by %s", async country => {
  mocks.domain.mockResolvedValue({ ...imported, property_address: "2/24 Test Street" });
  mocks.us.mockResolvedValue({ ...imported, property_address: "2/24 Test Street" });
  await expect(lookupCalculatorLeadProperty(property, country)).rejects.toThrow(/did not match/);
});
it("does not select a neighbouring property when no matching profile exists", async () => {
  mocks.search.mockResolvedValue([]);
  await expect(lookupCalculatorLeadProperty(property, "AU")).rejects.toThrow(/No matching/);
  expect(mocks.domain).not.toHaveBeenCalled();
});

it("looks up an explicitly selected Domain result without repeating autocomplete", async () => {
  const candidate = { source: "domain" as const, country: "AU" as const, address: "1/24 Test Street, Sydney NSW 2000",
    streetAddress: property.property_address, suburb: "Sydney", state: "NSW", postcode: "2000", slug: "selected-profile" };
  await lookupCalculatorLeadProperty(property, "AU", candidate);
  expect(mocks.domain).toHaveBeenCalledWith(candidate);
  expect(mocks.search).not.toHaveBeenCalled();
});

it("rejects a selected result for another unit before making a provider call", async () => {
  const candidate = { source: "domain" as const, country: "AU" as const, address: "2/24 Test Street, Sydney NSW 2000",
    streetAddress: "2/24 Test Street", suburb: "Sydney", state: "NSW", postcode: "2000", slug: "wrong-unit" };
  await expect(lookupCalculatorLeadProperty(property, "AU", candidate)).rejects.toThrow(/does not match/);
  expect(mocks.domain).not.toHaveBeenCalled();
  expect(mocks.search).not.toHaveBeenCalled();
});

it("uses a selected Zillow property ID after checking its complete address", async () => {
  const usProperty = { ...property, property_address: "123 Main St Apt 2", suburb: "Austin", state: "TX", postcode: "78701", country: "United States" };
  const candidate = { source: "zillow" as const, country: "US" as const, address: "123 Main St Apt 2, Austin TX 78701",
    streetAddress: usProperty.property_address, suburb: "Austin", state: "TX", postcode: "78701", zpid: "123456" };
  mocks.us.mockResolvedValue({ ...imported, ...usProperty });
  await lookupCalculatorLeadProperty(usProperty, "US", candidate);
  expect(mocks.us).toHaveBeenCalledWith(candidate);
});

it("rejects provider evidence from a different house when an ambiguous unit-first address loses its street during display normalization", async () => {
  const expected = { ...property, property_address: "Unit 2, 24 Test Street" };
  const candidate = { source: "domain" as const, country: "AU" as const, address: "Unit 2, 24 Test Street, Sydney NSW 2000",
    streetAddress: expected.property_address, suburb: "Sydney", state: "NSW", postcode: "2000", slug: "selected-profile" };
  mocks.domain.mockResolvedValue({ ...imported, property_address: "Unit 2, 26 Test Street" });
  await expect(lookupCalculatorLeadProperty(expected, "AU", candidate)).rejects.toThrow(/did not match/);
});

it("selects the latest verified historical photo set, excluding floor plans and older photos", async () => {
  mocks.domain.mockResolvedValue({ ...imported, hero_image_url: null, selected_image_urls: [], scraped_listing_json: {
    ...imported.scraped_listing_json, propertyLookup: { media: [
      { role: "photo", url: photo, date: "2025-01-01", current: false },
      { role: "floor_plan", url: "https://example.com/plan.jpg", date: "2025-01-01", current: false },
      { role: "photo", url: "https://example.com/old.jpg", date: "2020-01-01", current: false },
    ] },
  } });
  const result = await lookupCalculatorLeadProperty(property, "AU");
  expect(result.hero_image_url).toBe(photo);
  expect(result.selected_image_urls).toEqual([photo]);
  expect(result.scraped_listing_json?.propertyLookup?.media[0].date).toBe("2025-01-01");
});
