import { matchesUsProfile } from "@/lib/us-property/normalise";
import { marketForCountry } from "@/lib/property-market";
import { lookupDomainProperty, searchDomainProperties } from "./propertyLookup";
import { selectProfileCandidate } from "./profileAddress";
import { sameProperty } from "@/lib/listings/propertyIdentity";
import type { Listing } from "@/lib/types";

export function hasFreshPropertyProfile(listing: Listing, now = Date.now()) {
  const profile = listing.scraped_listing_json?.propertyLookup;
  if (marketForCountry(listing.country).country === "US" && !matchesUsProfile(listing, listing.scraped_listing_json?.usProperty)) return false;
  const age = now - Date.parse(profile?.matchedAt ?? "");
  return profile?.source === (marketForCountry(listing.country).country === "US" ? "zillow" : "domain") && profile.advertisedSalePrice !== undefined && age >= 0 && age < 24 * 60 * 60 * 1000;
}

/** Refresh provider evidence only; never replace edited property facts, prices or photos. */
export async function refreshPropertyProfile(listing: Listing) {
  if (marketForCountry(listing.country).country === "US") return (await import("@/lib/us-property/lookup")).refreshUsProperty(listing);
  const slug = listing.scraped_listing_json?.propertyLookup?.profileSlug;
  const query = [listing.property_address?.split(",")[0].trim(), listing.suburb, listing.state, listing.postcode].filter(Boolean).join(" ");
  const candidate = slug ? {
    source: "domain" as const, slug, address: query,
    streetAddress: listing.property_address ?? "", suburb: listing.suburb ?? "", state: listing.state ?? "", postcode: listing.postcode ?? "",
  } : selectProfileCandidate(await searchDomainProperties(query), listing);
  if (!candidate) throw new Error("No matching property profile was found. You can enter the figures and amenities manually.");
  const imported = await lookupDomainProperty(candidate);
  if (!sameProperty(listing, imported)) throw new Error("The imported profile did not match this property. Your saved details have been kept.");
  const source = imported.scraped_listing_json!;
  return {
    ...(listing.scraped_listing_json ?? source),
    domainAvm: source.domainAvm,
    propertyLookup: {
      ...source.propertyLookup!,
      // Keep the provenance of already imported media and agents intact.
      media: listing.scraped_listing_json?.propertyLookup?.media ?? source.propertyLookup!.media,
      originalAgents: listing.scraped_listing_json?.propertyLookup?.originalAgents ?? source.propertyLookup!.originalAgents,
    },
  };
}
