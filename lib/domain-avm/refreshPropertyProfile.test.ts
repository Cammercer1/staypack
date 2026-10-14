import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { lookupDomainProperty, searchDomainProperties } from "./propertyLookup";
import { hasFreshPropertyProfile, refreshPropertyProfile } from "./refreshPropertyProfile";
vi.mock("./propertyLookup", () => ({ lookupDomainProperty: vi.fn(), searchDomainProperties: vi.fn() }));
afterEach(() => vi.resetAllMocks());
function setup() {
  const { listing } = createLintRegressionFixtures();
  listing.scraped_listing_json = { ...listing.scraped_listing_json!, propertyLookup: { source: "domain", profileSlug: "test-property", matchedAt: new Date().toISOString(), media: [{ url: "https://example.test/kept.jpg", role: "photo", current: true }] } };
  const imported = { ...listing, listing_description: "Unreviewed description", scraped_listing_json: { ...listing.scraped_listing_json!, images: ["https://example.test/new.jpg"], propertyLookup: { source: "domain" as const, profileSlug: "test-property", matchedAt: new Date().toISOString(), advertisedSalePrice: "$1,200,000", media: [], features: ["pool"] } } };
  vi.mocked(lookupDomainProperty).mockResolvedValue(imported);
  return { listing, imported };
}
it("refreshes source evidence while preserving listing edits, images and LTR evidence", async () => {
  const { listing } = setup();
  const before = structuredClone(listing);
  const result = await refreshPropertyProfile(listing);
  expect(result.propertyLookup.features).toEqual(["pool"]);
  expect(result.images).toEqual(before.scraped_listing_json!.images);
  expect(result.rentalAppraisal).toEqual(before.scraped_listing_json!.rentalAppraisal);
  expect(result.propertyLookup.media).toEqual(before.scraped_listing_json!.propertyLookup!.media);
  expect(listing).toEqual(before);
  expect(searchDomainProperties).not.toHaveBeenCalled();
});
it("rejects a different property's profile rather than replacing local evidence", async () => {
  const { listing, imported } = setup();
  vi.mocked(lookupDomainProperty).mockResolvedValue({ ...imported, property_address: "999 Different Street" });
  await expect(refreshPropertyProfile(listing)).rejects.toThrow("did not match");
});
it("uses the verified address when there is no stored Domain slug", async () => {
  const { listing } = setup();
  listing.scraped_listing_json!.propertyLookup = undefined;
  vi.mocked(searchDomainProperties).mockResolvedValue([{ source: "domain", slug: "correct-property", streetAddress: listing.property_address!, address: listing.property_address!, suburb: listing.suburb!, state: listing.state!, postcode: listing.postcode! }]);
  await refreshPropertyProfile(listing);
  expect(lookupDomainProperty).toHaveBeenCalledWith(expect.objectContaining({ slug: "correct-property" }));
});
it("caches complete profiles for 24 hours, but refreshes legacy or stale profiles", () => {
  const { listing } = setup();
  expect(hasFreshPropertyProfile(listing)).toBe(false);
  listing.scraped_listing_json!.propertyLookup!.advertisedSalePrice = null;
  expect(hasFreshPropertyProfile(listing)).toBe(true);
  expect(hasFreshPropertyProfile(listing, Date.now() + 86400001)).toBe(false);
});
it("requires lookup to verify the original ranged address, including on later refreshes", async () => {
  const { listing, imported } = setup();
  Object.assign(listing, { property_address: "14A/18-24 Aubrey Street", suburb: "Surfers Paradise", state: "QLD", postcode: "4217" });
  listing.scraped_listing_json!.propertyLookup = undefined;
  vi.mocked(searchDomainProperties).mockResolvedValue([{ source: "domain", slug: "14a-18-aubrey-street", streetAddress: "14A/18 Aubrey Street", address: "14A/18 Aubrey Street, Surfers Paradise QLD 4217", suburb: "Surfers Paradise", state: "QLD", postcode: "4217" }]);
  vi.mocked(lookupDomainProperty).mockResolvedValue({ ...imported, ...listing, scraped_listing_json: imported.scraped_listing_json });
  await refreshPropertyProfile(listing);
  expect(lookupDomainProperty).toHaveBeenLastCalledWith(expect.objectContaining({ slug: "14a-18-aubrey-street", streetAddress: "14A/18-24 Aubrey Street" }));
  listing.scraped_listing_json!.propertyLookup = { ...imported.scraped_listing_json!.propertyLookup!, profileSlug: "14a-18-aubrey-street" };
  await refreshPropertyProfile(listing);
  expect(lookupDomainProperty).toHaveBeenLastCalledWith(expect.objectContaining({ slug: "14a-18-aubrey-street", streetAddress: "14A/18-24 Aubrey Street" }));
  expect(searchDomainProperties).toHaveBeenCalledTimes(1);
});
