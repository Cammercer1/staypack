import type { BlurbLength } from "@/lib/copy/blurbVariantConstants";

/** Default blurb length per layout family (fallback when template metadata is absent). */
export const FAMILY_DEFAULT_BLURB_LENGTH: Record<string, BlurbLength> = {
  minimalist: "long",
  split: "long",
  bold: "long",
  classic: "short",
  gallery: "short",
  refined: "medium",
  editorial: "short",
  landmark: "long",
  "haven-properties": "long",
  "belle-property": "long",
  belle: "long",
};

export function defaultBlurbLengthForFamily(family: string): BlurbLength {
  return FAMILY_DEFAULT_BLURB_LENGTH[family] ?? "medium";
}

export function isBoldFamily(family: string): boolean {
  return family === "bold";
}
