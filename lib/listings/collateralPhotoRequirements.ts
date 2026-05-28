import { MIN_COLLATERAL_PHOTOS } from "@/lib/listings/collateralImageLimits";
import { resolveMasterPhotoSelection } from "@/lib/listings/collateralImages";
import type { Listing } from "@/lib/types";

export function getMasterPhotoCount(listing: Listing) {
  return resolveMasterPhotoSelection(listing).selected_image_urls.length;
}

export function getCollateralPhotoRequirement(listing: Listing) {
  const count = getMasterPhotoCount(listing);

  return {
    count,
    minimum: MIN_COLLATERAL_PHOTOS,
    met: count >= MIN_COLLATERAL_PHOTOS,
    message: `Add at least ${MIN_COLLATERAL_PHOTOS} photos before creating collateral (${count} selected). Save your photos or click Select all on the Photos tab.`,
  };
}

export type CollateralPhotoRequirement = ReturnType<
  typeof getCollateralPhotoRequirement
>;

export function collateralPhotoRequirementError(listing: Listing) {
  const requirement = getCollateralPhotoRequirement(listing);
  if (requirement.met) return null;
  return requirement.message;
}
