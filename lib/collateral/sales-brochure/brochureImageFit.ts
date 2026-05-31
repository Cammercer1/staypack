import {
  getListingImageMeta,
  isFloorPlanUrlHeuristic,
  type ListingImageMeta,
  type ListingImageMetaMap,
} from "@/lib/listings/listingImageMeta";

export type BrochureImagePresentation = {
  role: "photo" | "floor_plan";
  imgClassName: string;
  frameClassName: string;
  caption?: string;
};

/** @deprecated Use resolveBrochureImagePresentation with listing_image_meta */
export function isBrochureFloorPlanUrl(url: string) {
  return isFloorPlanUrlHeuristic(url);
}

export function isBrochureFloorPlanImage(
  url: string,
  metaMap?: ListingImageMetaMap | null,
) {
  return resolveBrochureImagePresentation(url, null, metaMap).role === "floor_plan";
}

export function resolveBrochureImagePresentation(
  url: string,
  meta?: ListingImageMeta | null,
  metaMap?: ListingImageMetaMap | null,
): BrochureImagePresentation {
  const resolved =
    meta ?? (metaMap && url ? getListingImageMeta(metaMap, url) : undefined);
  const role = resolved?.role ?? (isFloorPlanUrlHeuristic(url) ? "floor_plan" : "photo");

  if (role === "floor_plan") {
    const caption = resolved?.label?.trim() || undefined;
    return {
      role,
      imgClassName: "max-h-full max-w-full object-contain object-center",
      frameClassName: "bg-white",
      caption,
    };
  }

  return {
    role: "photo",
    imgClassName: "h-full w-full min-h-0 min-w-0 object-cover object-center",
    frameClassName: "bg-neutral-200",
  };
}

/** Tailwind classes for property photos inside a fixed brochure frame. */
export function brochurePropertyPhotoClassName(
  url: string,
  metaMap?: ListingImageMetaMap | null,
) {
  return resolveBrochureImagePresentation(url, null, metaMap).imgClassName;
}

/** Background behind the image when letterboxing is expected. */
export function brochurePropertyPhotoFrameClassName(
  url: string,
  metaMap?: ListingImageMetaMap | null,
) {
  return resolveBrochureImagePresentation(url, null, metaMap).frameClassName;
}
