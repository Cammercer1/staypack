import type { ParsedListing } from "@/lib/types";

/** Unit-style address e.g. 5/326-342 Marine Parade. */
const UNIT_ADDRESS_PATTERN = /\d+\s*\/\s*\d+/;

/**
 * Property type for rent comp search/filtering.
 * Agency feeds often label strata stock as "Villa" — infer unit from address.
 */
export function resolveRentSubjectPropertyType(
  listing: ParsedListing,
): string | undefined {
  const declared = listing.propertyType?.trim();
  const address = listing.address?.trim() ?? "";
  const listingText = [listing.address, listing.title, listing.description]
    .filter(Boolean)
    .join(" ");

  if (declared && /unit|apartment|flat|studio/i.test(declared)) {
    return declared;
  }

  // Townhouses commonly use strata-style unit/street addresses. Preserve the
  // explicit listing type instead of treating the slash as apartment evidence.
  if (declared && /townhouse|town house|row house|terrace/i.test(declared)) {
    return declared;
  }

  // A declared house is authoritative. Legal references in descriptions such
  // as "CT 5451/654" must not be mistaken for a unit/street address.
  if (
    declared &&
    /\b(?:house|home|duplex|semi[-\s]?detached)\b/i.test(declared)
  ) {
    return declared;
  }

  if (UNIT_ADDRESS_PATTERN.test(address)) {
    return "Unit";
  }

  if (
    declared &&
    /villa/i.test(declared) &&
    /unit|apartment|strata|level\s+\d/i.test(listingText)
  ) {
    return "Unit";
  }

  return declared;
}
