import { MIN_COLLATERAL_PHOTOS } from "@/lib/listings/collateralImageLimits";
import { resolveMasterPhotoSelection } from "@/lib/listings/collateralImages";
import type { CollateralType, Listing } from "@/lib/types";

export function getMasterPhotoCount(listing: Listing) {
  return resolveMasterPhotoSelection(listing).selected_image_urls.length;
}

export function getCollateralPhotoRequirement(listing: Listing, type?: CollateralType) {
  const count = getMasterPhotoCount(listing);
  const minimum = type === "social_posts" ? 1 : MIN_COLLATERAL_PHOTOS;

  return {
    count,
    minimum,
    met: count >= minimum,
    message: `Add at least ${minimum} photo${minimum === 1 ? "" : "s"} before creating this document (${count} selected). Save your photos or click Select all on the Photos tab.`,
  };
}

export type CollateralPhotoRequirement = ReturnType<
  typeof getCollateralPhotoRequirement
>;

export function collateralPhotoRequirementError(listing: Listing, type?: CollateralType) {
  const requirement = getCollateralPhotoRequirement(listing, type);
  if (requirement.met) return null;
  return requirement.message;
}
