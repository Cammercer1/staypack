import { normalizeReaImageUrl } from "@/lib/scraping/rea/normalizeReaImageUrl";
import { resolveHeroGalleryImages } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import type { FinalReportJson } from "@/lib/types";

export type ReportImageSlot =
  | "hero"
  /** Bottom-row / side gallery photos (maps to display index + 1). */
  | { kind: "secondary"; index: number }
  /** Raw index in selected_image_urls (gallery template thumb row). */
  | { kind: "selected"; index: number };

/** Display order: hero, then up to three supporting photos (same as ClassicHeroGallery). */
export function orderedReportGalleryUrls(
  property: FinalReportJson["property"],
): string[] {
  const { hero, secondary } = resolveHeroGalleryImages(property);
  return [...(hero ? [hero] : []), ...secondary];
}

function gallerySlotIndex(slot: ReportImageSlot): number {
  if (slot === "hero") {
    return 0;
  }
  if (slot.kind === "secondary") {
    return slot.index + 1;
  }
  return slot.index;
}

function imagesFromOrderedGallery(ordered: string[]): {
  hero_image_url: string;
  selected_image_urls: string[];
} {
  const normalized = ordered
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => normalizeReaImageUrl(url));

  const unique: string[] = [];
  for (const url of normalized) {
    if (!unique.includes(url)) {
      unique.push(url);
    }
  }

  return {
    hero_image_url: unique[0] ?? "",
    selected_image_urls: unique,
  };
}

export function reportImageSlotLabel(slot: ReportImageSlot | null) {
  if (!slot) {
    return "photo";
  }
  if (slot === "hero") {
    return "hero photo";
  }
  if (slot.kind === "secondary") {
    return `photo ${slot.index + 2}`;
  }
  return `photo ${slot.index + 1}`;
}

export function getReportImageUrlAtSlot(
  property: FinalReportJson["property"],
  slot: ReportImageSlot,
): string {
  const ordered = orderedReportGalleryUrls(property);
  return ordered[gallerySlotIndex(slot)] ?? "";
}

export function replaceReportImageAtSlot(
  report: FinalReportJson,
  slot: ReportImageSlot,
  newUrl: string,
): FinalReportJson {
  const property = replaceReportPropertyImage(report.property, slot, newUrl);
  return { ...report, property };
}

export function replaceReportPropertyImage(
  property: FinalReportJson["property"],
  slot: ReportImageSlot,
  newUrl: string,
): FinalReportJson["property"] {
  const ordered = orderedReportGalleryUrls(property);
  const index = gallerySlotIndex(slot);
  const next = [...ordered];

  while (next.length <= index) {
    next.push("");
  }

  next[index] = normalizeReaImageUrl(newUrl);

  const images = imagesFromOrderedGallery(next);
  return {
    ...property,
    hero_image_url: images.hero_image_url,
    selected_image_urls: images.selected_image_urls,
  };
}

export type ReportPropertyImageSelection = Pick<
  FinalReportJson["property"],
  "hero_image_url" | "selected_image_urls"
>;

export function pickReportPropertyImages(
  property: FinalReportJson["property"],
): ReportPropertyImageSelection {
  return {
    hero_image_url: property.hero_image_url,
    selected_image_urls: property.selected_image_urls,
  };
}
