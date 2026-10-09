import { expect, it } from "vitest";
import { createEmptyListingDraft } from "./emptyListingDraft";
import { filterListings, formatListingDate } from "./listingLibrary";

const listings = [
  createEmptyListingDraft({
    id: "sale",
    property_address: "12 Ocean Street",
    suburb: "Bondi",
    postcode: "2026",
    listing_purpose: "sale",
    created_at: "2026-10-01T00:00:00Z",
    scraped_listing_json: {
      images: [],
      agents: [{ name: "Alex Mercer" }],
      confidence: "high",
      warnings: [],
    },
  }),
  createEmptyListingDraft({
    id: "lease",
    property_address: "2 Ocean Street",
    suburb: "Coogee",
    listing_purpose: "lease",
    created_at: "2026-10-02T00:00:00Z",
  }),
];

it("matches multiple search terms across address, location and agents", () => {
  const result = filterListings(listings, {
    query: "  ALEX bondi 2026 ",
    sort: "newest",
  });
  expect(result.map((listing) => listing.id)).toEqual(["sale"]);
});

it("sorts addresses naturally without mutating the source array", () => {
  expect(
    filterListings(listings, {
      query: "",
      sort: "address",
    }).map((listing) => listing.id),
  ).toEqual(["lease", "sale"]);
  expect(listings.map((listing) => listing.id)).toEqual(["sale", "lease"]);
});

it("handles missing property details and invalid dates", () => {
  const empty = createEmptyListingDraft({ created_at: "invalid" });
  expect(filterListings([empty], { query: "", sort: "newest" })).toEqual([
    empty,
  ]);
  expect(filterListings([empty], { query: "Bondi", sort: "newest" })).toEqual(
    [],
  );
  expect(formatListingDate("invalid")).toBe("Date unavailable");
  expect(formatListingDate("2026-10-08T23:00:00Z")).toBe("9 Oct 2026");
});
