import type { CollateralType, Listing, ListingPurpose } from "@/lib/types";

const LEASE_ONLY: CollateralType[] = ["rental_brochure"];
const SALE_ONLY: CollateralType[] = ["sales_brochure", "str_report"];

export function collateralPurposeMismatchError(
  listing: Pick<Listing, "listing_purpose">,
  collateralType: CollateralType,
): string | null {
  const purpose: ListingPurpose = listing.listing_purpose ?? "sale";

  if (purpose === "lease" && SALE_ONLY.includes(collateralType)) {
    return "This collateral type is not available for lease listings";
  }

  if (purpose === "sale" && LEASE_ONLY.includes(collateralType)) {
    return "Lease brochures are only available for lease listings";
  }

  return null;
}
