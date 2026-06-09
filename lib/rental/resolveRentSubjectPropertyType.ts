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
  const haystack = [listing.address, listing.title, listing.description]
    .filter(Boolean)
    .join(" ");

  if (declared && /unit|apartment|flat|studio/i.test(declared)) {
    return declared;
  }

  if (UNIT_ADDRESS_PATTERN.test(haystack)) {
    return "Unit";
  }

  if (declared && /villa/i.test(declared) && /unit|apartment|strata|level\s+\d/i.test(haystack)) {
    return "Unit";
  }

  return declared;
}
