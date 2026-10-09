import type { CollateralType, Listing } from "@/lib/types";

/** Document type defines its purpose; one property can support every option. */
export function collateralPurposeMismatchError(
  listing: Pick<Listing, "listing_purpose">,
  collateralType: CollateralType,
): string | null {
  void listing;
  void collateralType;
  return null;
}
