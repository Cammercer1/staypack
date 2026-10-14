import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";
import { getLayersForVariant } from "./variantLayers";

export function socialSavePayload(next: SocialPostsDocumentJson, saved: SocialPostsDocumentJson) {
  const layers = getLayersForVariant(next, next.active_variant_id);
  const savedLayers = getLayersForVariant(saved, next.active_variant_id);
  return {
    active_variant_id: next.active_variant_id,
    agent: next.agent,
    listing: { bedrooms: next.listing.bedrooms, bathrooms: next.listing.bathrooms, car_spaces: next.listing.car_spaces, land_area_sqm: next.listing.land_area_sqm },
    // Sending a layer patch marks the layout customized. A save or download of
    // unchanged content must not switch a preset design to a custom layout.
    ...(JSON.stringify(layers) !== JSON.stringify(savedLayers) ? { layers } : {}),
    variants: next.variants,
  };
}
