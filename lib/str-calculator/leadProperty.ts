import "server-only";
import { lookupDomainProperty, searchDomainProperties } from "@/lib/domain-avm/propertyLookup";
import { selectProfileCandidate } from "@/lib/domain-avm/profileAddress";
import { lookupUsProperty } from "@/lib/us-property/lookup";
import { sameProperty } from "@/lib/listings/propertyIdentity";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import type { Listing } from "@/lib/types";

/** Import evidence for a new, separate lead property. Never import provider room
 * counts or coordinates over the calculator inputs used by the cached estimate. */
export async function lookupCalculatorLeadProperty(property: Partial<Listing>, country: "AU" | "US") {
  const expected = createEmptyListingDraft(property);
  let imported: Listing;
  if (country === "US") {
    imported = await lookupUsProperty({ source: "zillow", country: "US", address: expected.property_address ?? "",
      streetAddress: expected.property_address ?? "", suburb: expected.suburb ?? "", state: expected.state ?? "", postcode: expected.postcode ?? "" });
  } else {
    const query = [expected.property_address, expected.suburb, expected.state, expected.postcode].filter(Boolean).join(" ");
    const candidate = selectProfileCandidate(await searchDomainProperties(query), expected);
    if (!candidate) throw new Error("No matching property profile was found.");
    imported = await lookupDomainProperty(candidate);
  }
  if (!sameProperty(expected, imported)) throw new Error("The property profile did not match the enquiry.");
  const photos = (imported.scraped_listing_json?.propertyLookup?.media ?? []).filter(media => media.role === "photo");
  const latestDate = photos.map(photo => photo.date).filter((date): date is string => Boolean(date)).sort().at(-1);
  const selected = imported.selected_image_urls?.length ? imported.selected_image_urls :
    [...new Set(photos.filter(photo => !latestDate || photo.date === latestDate).map(photo => photo.url))].slice(0, 25);
  return {
    scraped_listing_json: imported.scraped_listing_json,
    hero_image_url: imported.hero_image_url ?? selected[0] ?? null,
    selected_image_urls: selected,
    listing_image_meta: imported.listing_image_meta,
    property_type: imported.property_type,
    car_spaces: imported.car_spaces,
  };
}
