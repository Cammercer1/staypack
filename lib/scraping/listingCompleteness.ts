import type { ParsedListing } from "@/lib/types";

export const MIN_DELIVERY_DESCRIPTION_CHARS = 80;
export const MIN_STR_DELIVERY_IMAGES = 5;

export function listingMissingCoreFields(listing: ParsedListing): string[] {
  const missing: string[] = [];

  if (!listing.address?.trim()) missing.push("address");
  if (!listing.suburb?.trim()) missing.push("suburb");
  if (!listing.state?.trim()) missing.push("state");
  if (!listing.postcode?.trim()) missing.push("postcode");
  if (listing.bedrooms == null) missing.push("bedrooms");
  if (listing.bathrooms == null) missing.push("bathrooms");

  const descriptionLength = listing.description?.trim().length ?? 0;
  if (descriptionLength < MIN_DELIVERY_DESCRIPTION_CHARS) {
    missing.push(
      descriptionLength === 0
        ? "description"
        : `description (${descriptionLength}/${MIN_DELIVERY_DESCRIPTION_CHARS} chars)`,
    );
  }

  return missing;
}

export type DeliveryListingReadiness = {
  coreReady: boolean;
  strReady: boolean;
  leaseReady: boolean;
  missingCore: string[];
  missingStr: string[];
};

export function assessDeliveryListingReadiness(
  listing: ParsedListing,
): DeliveryListingReadiness {
  const missingCore = listingMissingCoreFields(listing);
  const imageCount = listing.images.length;
  const missingStr = [...missingCore];

  if (imageCount < MIN_STR_DELIVERY_IMAGES) {
    missingStr.push(`images (${imageCount}/${MIN_STR_DELIVERY_IMAGES})`);
  }

  return {
    coreReady: missingCore.length === 0,
    strReady: missingStr.length === 0,
    leaseReady: missingCore.length === 0,
    missingCore,
    missingStr,
  };
}

export function formatDeliveryReadinessFailure(
  readiness: DeliveryListingReadiness,
  target: "str" | "lease" | "core" = "str",
): string {
  const missing =
    target === "str"
      ? readiness.missingStr
      : target === "lease"
        ? readiness.missingCore
        : readiness.missingCore;

  return `Insufficient listing data for delivery: missing ${missing.join(", ")}`;
}
