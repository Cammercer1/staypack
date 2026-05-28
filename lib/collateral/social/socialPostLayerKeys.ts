import { getLayersForVariant } from "@/lib/collateral/social/variantLayers";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";

export const SOCIAL_POST_LAYER_KEYS = [
  "logo",
  "title",
  "subcopy",
  "agent",
] as const;

export type SocialPostLayerKey = (typeof SOCIAL_POST_LAYER_KEYS)[number];

export function getEnabledSocialPostLayers(
  document: SocialPostsDocumentJson,
  variantId: SocialPostVariantId = document.active_variant_id,
): SocialPostLayerKey[] {
  const { agency } = document;
  const layers = getLayersForVariant(document, variantId);
  const enabled: SocialPostLayerKey[] = [];

  if (layers.logo.enabled && agency.logo_url) {
    enabled.push("logo");
  }
  if (layers.title.enabled && layers.title.text.trim()) {
    enabled.push("title");
  }
  if (layers.subcopy.enabled && layers.subcopy.text.trim()) {
    enabled.push("subcopy");
  }
  if (layers.agent?.enabled) {
    enabled.push("agent");
  }

  return enabled;
}
