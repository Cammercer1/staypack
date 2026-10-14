import { appraisalInputFingerprint } from "@/lib/appraisals/resolveAppraisalInput";
import { zillowPropertyId } from "./url";
export { zillowPropertyId } from "./url";
import { fetchUsPropertyData } from "./client";
import { matchesUsAddress, normaliseUsProperty } from "./normalise";
import { matchesUsSearch } from "./address";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { buildScrapedListingFields } from "@/lib/listings/buildScrapedListingFields";
import type { PropertyCandidate } from "@/lib/listings/propertyLookupTypes";
import type { Listing } from "@/lib/types";
function draftFromResult(result: ReturnType<typeof normaliseUsProperty>) {
  return createEmptyListingDraft({ ...buildScrapedListingFields(result.url, result.parsed), country: "United States", latitude: result.latitude, longitude: result.longitude });
}
export async function searchUsProperties(query: string): Promise<PropertyCandidate[]> {
  // Send the user's address directly: geocoders can drop directions or units.
  const { parsed } = normaliseUsProperty(await fetchUsPropertyData("property-details-address", { address: query }));
  if (!matchesUsSearch(query, parsed.address!, parsed.state!, parsed.postcode!)) return [];
  return [{ source: "zillow", country: "US", address: [parsed.address, parsed.suburb, parsed.state, parsed.postcode].join(", "), streetAddress: parsed.address!, suburb: parsed.suburb!, state: parsed.state!, postcode: parsed.postcode!, zpid: parsed.usProperty!.zpid }];
}
export async function lookupUsProperty(candidate: PropertyCandidate) {
  const address = [candidate.streetAddress, candidate.suburb, candidate.state, candidate.postcode].join(", ");
  const result = normaliseUsProperty(await (candidate.zpid
    ? fetchUsPropertyData("property-details", { zpid: candidate.zpid })
    : fetchUsPropertyData("property-details-address", { address })));
  if (candidate.zpid && result.parsed.usProperty?.zpid !== candidate.zpid) {
    throw new Error("The returned property did not match the selected home. Try its Zillow link or enter the details manually.");
  }
  if (!matchesUsAddress({ address: candidate.streetAddress, state: candidate.state, postcode: candidate.postcode }, result.parsed)) {
    throw new Error("The returned US profile does not match the selected street, unit or ZIP code. Enter the details manually.");
  }
  return draftFromResult(result);
}
export async function importUsProperty(url: string) {
  const zpid = zillowPropertyId(url);
  if (!zpid) throw new Error("Open the individual home or apartment on Zillow and copy its full link from the address bar, or search using its street address and apartment number.");
  const result = normaliseUsProperty(await fetchUsPropertyData("property-details", { zpid }));
  if (result.parsed.usProperty?.zpid !== zpid) throw new Error("The returned property did not match the Zillow link.");
  return draftFromResult(result);
}
export async function refreshUsProperty(listing: Listing) {
  const draft = await lookupUsProperty({ source: "zillow", country: "US", address: listing.property_address ?? "", streetAddress: listing.property_address ?? "", suburb: listing.suburb ?? "", state: listing.state ?? "", postcode: listing.postcode ?? "" });
  const source = draft.scraped_listing_json!;
  return { ...(listing.scraped_listing_json ?? source), country: "US", usProperty: source.usProperty, domainAvm: undefined, domainAvmInputFingerprint: appraisalInputFingerprint(listing),
    propertyLookup: { ...source.propertyLookup!, media: listing.scraped_listing_json?.propertyLookup?.media ?? source.propertyLookup!.media, originalAgents: listing.scraped_listing_json?.propertyLookup?.originalAgents } };
}
