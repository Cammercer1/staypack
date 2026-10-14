import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  fetchDomainJson: vi.fn(),
  hasDomainAvmConfig: () => true,
}));
import { fetchDomainJson } from "./client";
import {
  lookupDomainProperty,
  normalizePropertyLookup,
} from "./propertyLookup";
import { createListingSchema } from "@/lib/validation/schemas";
import {
  newListingPayload,
  valuesFromListing,
} from "@/lib/listings/newListingDraft";
import { initialListingAgents } from "@/lib/reports/listingAgents";
import { resolveMasterPhotoSelection } from "@/lib/listings/collateralImages";
import { resolveListingImageRole } from "@/lib/listings/listingImageMeta";

const profile = {
  address: {
    unitNumber: "12",
    streetNumber: "22A",
    street: "New Street",
    suburbName: "Bondi",
    state: "NSW",
    postcode: "2026",
    displayAddress: "12/22A New Street, Bondi NSW 2026",
    geolocation: { latitude: -33.88, longitude: 151.26 },
  },
  bedrooms: 2,
  bathrooms: 1,
  parkingSpaces: 1,
  type: "Apartment",
  'internalArea({"unit":"SQUARE_METERS"})': 64,
  valuation: { lowerPrice: 1000000, midPrice: 1100000, upperPrice: 1200000, priceConfidence: "high", date: "2026-10-09" },
  rentalEstimate: { weeklyRentEstimate: 950, rentalFsdConfidence: "medium", estimateDate: "2026-10-09", percentYieldRentEstimate: 4.5 },
  listings: [{ status: "LIVE", type: "BUY", listingId: 2021107984 }],
  media: [
    {
      type: "photo",
      url: "https://example.com/thumb.jpg",
      'url({"width":2040})': "https://example.com/large.jpg",
      date: "2020-01-01T00:00:00Z",
    },
    {
      type: "floorplan",
      url: "https://example.com/plan.jpg",
      date: "2020-01-01",
    },
  ],
};
const active = {
  id: 2021107984,
  lifecycle_status: "Live",
  search_mode: "buy",
  seo_url:
    "https://www.domain.com.au/12-22a-new-street-bondi-nsw-2026-2021107984",
  metadata: {
    address_components: {
      unit_number: "12",
      street_number: "22A",
      street: "New Street",
      suburb: "Bondi",
      state_short: "NSW",
      postcode: "2026",
    },
  },
  bedroom_count: 2,
  bathroom_count: 1,
  dwelling_type: "Apartment",
  headline: "Current headline",
  description: "Current description",
  price: "For Sale $1,175,000",
  media: [
    {
      media_type: "image",
      type: "photo",
      image_url: "https://example.com/current.jpg",
    },
    {
      media_type: "image",
      type: "floor_plan",
      image_url: "https://example.com/current-plan.jpg",
    },
  ],
  advertiser: {
    name: "Listing Agency",
    agency_listing_contacts: [
      {
        display_full_name: "Example Agent",
        email_address: "agent@example.com",
        image_url: "https://example.com/agent.png",
        phone_numbers: [{ type: "Mobile", number: "0412345678" }],
      },
    ],
  },
};
const candidate = {
  source: "domain" as const,
  slug: "12-22a-new-street-bondi-nsw-2026",
  address: profile.address.displayAddress,
  streetAddress: "12/22A New Street",
  suburb: "Bondi",
  state: "NSW",
  postcode: "2026",
};
beforeEach(() => vi.resetAllMocks());
it("uses current listing media, copy and agent portraits, keeping unknown parking blank", () => {
  const result = normalizePropertyLookup(profile, candidate.slug, active);
  expect(result).toMatchObject({
    bedrooms: 2,
    bathrooms: 1,
    car_spaces: null,
    display_price: active.price,
    listing_title: active.headline,
    latitude: -33.88,
  });
  expect(result.selected_image_urls).toEqual([
    "https://example.com/current.jpg",
  ]);
  expect(result.scraped_listing_json?.images).not.toContain(
    "https://example.com/large.jpg",
  );
  expect(result.scraped_listing_json?.agents[0]).toMatchObject({
    name: "Example Agent",
    photo_url: "https://example.com/agent.png",
    phone: "0412345678",
  });
  expect(
    resolveListingImageRole(
      result.listing_image_meta,
      "https://example.com/current-plan.jpg",
    ),
  ).toBe("floor_plan");
  const saved = createListingSchema.parse(
    newListingPayload(
      result,
      valuesFromListing(result),
      initialListingAgents(result.scraped_listing_json?.agents),
    ),
  );
  expect(saved.scraped_listing_json?.domainAvm).toMatchObject({
    valuation: { lowerPrice: 1000000, midPrice: 1100000, upperPrice: 1200000, confidence: "high", date: "2026-10-09" },
    rentalEstimate: { weeklyRent: 950, confidence: "medium", date: "2026-10-09", yieldPct: 4.5 },
  });
  expect(
    saved.scraped_listing_json?.propertyLookup?.originalAgents?.[0].photo_url,
  ).toBe("https://example.com/agent.png");
  expect(saved.listing_agents?.[0].photo_url).toBe(
    "https://example.com/agent.png",
  );
});
it("keeps historical media dated and unselected, without historical agents or asking prices", () => {
  const result = normalizePropertyLookup(
    {
      ...profile,
      listings: [
        { status: "SOLD", contacts: active.advertiser.agency_listing_contacts },
      ],
    },
    candidate.slug,
  );
  expect(result.scraped_listing_json?.images).toEqual([
    "https://example.com/large.jpg",
    "https://example.com/plan.jpg",
  ]);
  expect(result.scraped_listing_json?.propertyLookup?.media[0].date).toBe(
    "2020-01-01",
  );
  expect(result.scraped_listing_json?.agents).toEqual([]);
  expect(result.display_price).toBeNull();
  expect(result.selected_image_urls).toEqual([]);
  expect(resolveMasterPhotoSelection(result).selected_image_urls).toEqual([]);
});
it("preserves an explicit zero parking count", () => {
  expect(
    normalizePropertyLookup(profile, candidate.slug, {
      ...active,
      car_space_count: 0,
    }).car_spaces,
  ).toBe(0);
});
it.each([
  { ...active, lifecycle_status: "Sold" },
  {
    ...active,
    metadata: {
      address_components: {
        ...active.metadata.address_components,
        unit_number: "16",
      },
    },
  },
])("rejects a stale or different unit's listing and agents", (details) => {
  const result = normalizePropertyLookup(profile, candidate.slug, details);
  expect(
    result.scraped_listing_json?.propertyLookup?.activeListingId,
  ).toBeUndefined();
  expect(result.scraped_listing_json?.agents).toEqual([]);
  expect(result.display_price).toBeNull();
});
it("rejects a provider profile mismatch before fetching listing details", async () => {
  vi.mocked(fetchDomainJson).mockResolvedValue({
    data: {
      propertyDetails: {
        ...profile,
        address: {
          ...profile.address,
          displayAddress: "16/22A New Street, Bondi NSW 2026",
        },
      },
    },
  });
  await expect(lookupDomainProperty(candidate)).rejects.toThrow(
    "did not match",
  );
  expect(fetchDomainJson).toHaveBeenCalledTimes(1);
});
it("accepts the Glenelg profile with provider whitespace before the comma", async () => {
  // Address shape returned by the provider for this off-market property.
  vi.mocked(fetchDomainJson).mockResolvedValueOnce({
    data: {
      propertyDetails: {
        ...profile,
        address: {
          unitNumber: null,
          streetNumber: "24",
          streetName: "South Esplanade",
          streetType: null,
          streetTypeLong: null,
          street: null,
          suburbName: "Glenelg",
          state: "SA",
          postcode: "5045",
          displayAddress: "24 South Esplanade , Glenelg SA 5045",
          geolocation: { latitude: -34.98516, longitude: 138.51086 },
        },
        listings: [],
      },
    },
  });
  const result = await lookupDomainProperty({
    source: "domain",
    slug: "24-south-esplanade-glenelg-sa-5045",
    address: "24 South Esplanade, Glenelg SA 5045",
    streetAddress: "24 South Esplanade",
    suburb: "Glenelg",
    state: "SA",
    postcode: "5045",
  });
  expect(result).toMatchObject({
    property_address: "24 South Esplanade",
    suburb: "Glenelg",
    state: "SA",
    postcode: "5045",
    latitude: -34.98516,
    longitude: 138.51086,
    selected_image_urls: [],
  });
  expect(fetchDomainJson).toHaveBeenCalledTimes(1);
});
it("preserves property facts when the live listing endpoint fails", async () => {
  vi.mocked(fetchDomainJson)
    .mockResolvedValueOnce({ data: { propertyDetails: profile } })
    .mockRejectedValueOnce(new Error("Provider unavailable"));
  const result = await lookupDomainProperty(candidate);
  expect(result.bedrooms).toBe(2);
  expect(result.scraped_listing_json?.agents).toEqual([]);
  expect(result.scraped_listing_json?.warnings.join(" ")).toContain(
    "could not be loaded",
  );
});

const rangeProfile = {
  ...profile,
  address: { ...profile.address, unitNumber: "14A", streetNumber: "18", street: "Aubrey Street", suburbName: "Surfers Paradise", state: "QLD", postcode: "4217", displayAddress: "14A/18 Aubrey Street, Surfers Paradise QLD 4217" },
  features: ["Air Conditioning", "Pool"],
  listings: [{ status: "LIVE", type: "BUY", listingId: active.id, address: { displayAddress: "14A/18-24 Aubrey Street, Surfers Paradise QLD 4217" } }],
};
const rangeCandidate = { ...candidate, slug: "14a-18-aubrey-street-surfers-paradise-qld-4217", streetAddress: "14A/18-24 Aubrey Street", address: rangeProfile.listings[0].address.displayAddress, suburb: "Surfers Paradise", state: "QLD", postcode: "4217" };
const rangeActive = { ...active, metadata: { address_components: { unit_number: "14A", street_number: "18-24", street: "Aubrey Street", suburb: "Surfers Paradise", state_short: "QLD", postcode: "4217" } }, features: ["Balcony"], car_space_count: 1 };

it("imports a range alias only when the profile explicitly links the requested address", async () => {
  vi.mocked(fetchDomainJson)
    .mockResolvedValueOnce({ data: { propertyDetails: rangeProfile } })
    .mockResolvedValueOnce({ data: rangeActive });
  const result = await lookupDomainProperty(rangeCandidate);
  expect(result).toMatchObject({ property_address: "14A/18-24 Aubrey Street", car_spaces: 1 });
  expect(result.scraped_listing_json?.propertyLookup).toMatchObject({ activeListingId: active.id, features: ["Air Conditioning", "Pool", "Balcony"] });
  expect(result.selected_image_urls).toEqual(["https://example.com/current.jpg"]);
  expect(result.scraped_listing_json?.domainAvm?.valuation?.midPrice).toBe(1100000);
});

it.each([
  { listings: [] },
  { listings: [{ ...rangeProfile.listings[0], address: { displayAddress: "14B/18-24 Aubrey Street, Surfers Paradise QLD 4217" } }] },
  { listings: [{ ...rangeProfile.listings[0], address: { displayAddress: "14A/18-24 Aubrey Street, Surfers Paradise QLD 4000" } }] },
])("rejects range aliases without matching linked evidence", async ({ listings }) => {
  vi.mocked(fetchDomainJson).mockResolvedValueOnce({ data: { propertyDetails: { ...rangeProfile, listings } } });
  await expect(lookupDomainProperty(rangeCandidate)).rejects.toThrow("did not match");
  expect(fetchDomainJson).toHaveBeenCalledTimes(1);
});

it("rejects the wrong unit even if the profile links its address", async () => {
  const wrong = { ...rangeCandidate, streetAddress: "14B/18-24 Aubrey Street" };
  vi.mocked(fetchDomainJson).mockResolvedValueOnce({ data: { propertyDetails: { ...rangeProfile, listings: [{ ...rangeProfile.listings[0], address: { displayAddress: "14B/18-24 Aubrey Street, Surfers Paradise QLD 4217" } }] } } });
  await expect(lookupDomainProperty(wrong)).rejects.toThrow("did not match");
});

it("keeps the verified alias and profile amenities when the live endpoint fails", async () => {
  vi.mocked(fetchDomainJson)
    .mockResolvedValueOnce({ data: { propertyDetails: rangeProfile } })
    .mockRejectedValueOnce(new Error("Provider unavailable"));
  const result = await lookupDomainProperty(rangeCandidate);
  expect(result.property_address).toBe(rangeCandidate.streetAddress);
  expect(result.scraped_listing_json?.propertyLookup?.features).toEqual(["Air Conditioning", "Pool"]);
});

it("does not accept a live range alias using evidence from a different listing ID", () => {
  const result = normalizePropertyLookup({ ...rangeProfile, listings: [profile.listings[0], { ...rangeProfile.listings[0], listingId: active.id + 1 }] }, rangeCandidate.slug, rangeActive);
  expect(result.scraped_listing_json?.propertyLookup?.activeListingId).toBeUndefined();
  expect(result.selected_image_urls).toEqual([]);
});
