import type { Listing, StrCompCard } from "@/lib/types";
import { propertyCategory } from "./comparables";

/** Property fit comes first. Neither selection nor high revenue establishes a match. */
export function matchingManagedComps(comps: StrCompCard[], listing: Pick<Listing, "bedrooms" | "property_type">) {
  const category = propertyCategory(listing.property_type);
  return comps.filter((comp) => comp.professional_management === true &&
    listing.bedrooms != null && comp.bedrooms === listing.bedrooms &&
    category != null && propertyCategory(comp.property_type) === category &&
    (!comp.room_type || comp.room_type === "entire_home"));
}

export function managementEvidenceSummary(comps: StrCompCard[], listing: Pick<Listing, "bedrooms" | "property_type">, target: number | null) {
  const matching = matchingManagedComps(comps, listing);
  const revenues = matching.map((comp) => comp.annual_revenue).filter((value): value is number => value != null && Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const middle = Math.floor(revenues.length / 2);
  return {
    count: matching.length,
    revenueCount: revenues.length,
    atOrAbove: target == null ? null : revenues.filter((value) => value >= target).length,
    median: revenues.length === 0 ? null : revenues.length % 2 ? revenues[middle] : (revenues[middle - 1] + revenues[middle]) / 2,
    limited: revenues.length < 3,
  };
}
