/** True when the URL likely points at a floor/site plan (show full image, letterbox if needed). */
export function isBrochureFloorPlanUrl(url: string) {
  const lower = url.toLowerCase();
  return /floor[-_]?plan|floorplan|site[-_]?plan|siteplan/.test(lower);
}

/** Tailwind classes for property photos inside a fixed brochure frame. */
export function brochurePropertyPhotoClassName(url: string) {
  return isBrochureFloorPlanUrl(url)
    ? "h-full w-full object-contain object-center"
    : "h-full w-full object-cover object-center";
}

/** Background behind the image when letterboxing is expected. */
export function brochurePropertyPhotoFrameClassName(url: string) {
  return isBrochureFloorPlanUrl(url) ? "bg-white" : "bg-neutral-200";
}
