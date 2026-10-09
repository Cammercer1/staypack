import { initialListingAgents } from "@/lib/reports/listingAgents";
import type { Listing } from "@/lib/types";

export type ListingSort = "newest" | "oldest" | "address";

export function listingAgentsLabel(listing: Listing) {
  return initialListingAgents(listing.scraped_listing_json?.agents)
    .map((agent) => agent.name.trim())
    .filter(Boolean)
    .join(", ");
}

export function filterListings(
  listings: Listing[],
  { query, sort }: { query: string; sort: ListingSort },
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = listings.filter((listing) => {
    const text = [
      listing.property_address,
      listing.suburb,
      listing.state,
      listing.postcode,
      listingAgentsLabel(listing),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });

  return filtered.sort((a, b) => {
    if (sort === "address") {
      return (a.property_address ?? "Untitled listing").localeCompare(
        b.property_address ?? "Untitled listing",
        "en-AU",
        { numeric: true },
      );
    }
    const difference =
      (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0);
    return sort === "oldest" ? difference : -difference;
  });
}

export function formatListingDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  // Keep server rendering and browser hydration consistent across time zones.
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(date);
}
