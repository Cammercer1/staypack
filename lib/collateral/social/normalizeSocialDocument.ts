import {
  normalizeAgentBackgroundStyle,
  normalizeAgentBrandColour,
  normalizeHexColour,
  defaultAgentLayerStyle,
} from "@/lib/collateral/social/agentStyle";
import {
  normalizeAgentLayout,
  normalizeAvatarShape,
} from "@/lib/collateral/social/agentLayer";
import {
  normalizeFeaturesLayer,
  normalizeListingSlice,
} from "@/lib/collateral/social/listingFeatures";
import { migrateLayersToPresets } from "@/lib/collateral/social/presetPlacement";
import {
  normalizeAgentInnerGapScale,
  normalizeAgentScale,
  normalizeLogoScale,
  normalizeTextAlign,
  normalizeTextBoxHeightScale,
  normalizeTextBoxWidthScale,
  normalizeTextScale,
  normalizeTextLineGapScale,
  normalizeTextZoneInset,
} from "@/lib/collateral/social/layerScale";
import {
  imagePoolFromDocument,
  migrateVariantBackground,
} from "@/lib/collateral/social/backgroundLayout";
import { normalizeLogoColour } from "@/lib/collateral/social/logoColour";
import {
  migrateSocialPostVariants,
  SOCIAL_POST_VARIANT_IDS,
} from "@/lib/collateral/social/formats";
import {
  ensurePerVariantLayers,
  getLayersForVariant,
} from "@/lib/collateral/social/variantLayers";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";

const EMPTY_AGENT: SocialPostsDocumentJson["agent"] = {
  name: "",
  role_title: "",
  phone: "",
  email: "",
  photo_url: "",
};

const DEFAULT_AGENT_LAYER_BASE: Omit<
  SocialPostsDocumentJson["layers"]["agent"],
  | "background_style"
  | "background_colour"
  | "text_colour"
  | "brand_colour"
> = {
  enabled: false,
  placement: "bottom_left",
  scale: 1,
  inner_gap_scale: 1,
  layout: "horizontal",
  avatar_shape: "circle",
};

export function normalizeSocialLayers(
  layers: SocialPostsDocumentJson["layers"],
  agency: SocialPostsDocumentJson["agency"],
): SocialPostsDocumentJson["layers"] {
  const migrated = migrateLayersToPresets(layers);
  const styleDefaults = defaultAgentLayerStyle(agency);
  const agent = {
    ...styleDefaults,
    ...DEFAULT_AGENT_LAYER_BASE,
    ...migrated.agent,
  };

  return {
    logo: {
      ...migrated.logo,
      scale: normalizeLogoScale(migrated.logo.scale),
      colour: normalizeLogoColour(migrated.logo.colour),
    },
    title: {
      ...migrated.title,
      scale: normalizeTextScale(migrated.title.scale),
      box_width_scale: normalizeTextBoxWidthScale(migrated.title.box_width_scale),
      box_height_scale: normalizeTextBoxHeightScale(
        migrated.title.box_height_scale,
      ),
      align: normalizeTextAlign(migrated.title.align),
      zone_inset_top: normalizeTextZoneInset(migrated.title.zone_inset_top),
      zone_inset_bottom: normalizeTextZoneInset(migrated.title.zone_inset_bottom),
      line_gap_scale: normalizeTextLineGapScale(migrated.title.line_gap_scale),
    },
    subcopy: {
      ...migrated.subcopy,
      scale: normalizeTextScale(migrated.subcopy.scale),
      box_width_scale: normalizeTextBoxWidthScale(migrated.title.box_width_scale),
      box_height_scale: normalizeTextBoxHeightScale(
        migrated.subcopy.box_height_scale,
      ),
      align: normalizeTextAlign(migrated.subcopy.align),
      block_placement: migrated.title.block_placement,
      zone_inset_top: normalizeTextZoneInset(migrated.title.zone_inset_top),
      zone_inset_bottom: normalizeTextZoneInset(migrated.title.zone_inset_bottom),
      line_gap_scale: normalizeTextLineGapScale(migrated.title.line_gap_scale),
    },
    features: normalizeFeaturesLayer(migrated.features),
    agent: {
      ...agent,
      scale: normalizeAgentScale(agent.scale),
      inner_gap_scale: normalizeAgentInnerGapScale(agent.inner_gap_scale),
      placement: agent.placement,
      layout: normalizeAgentLayout(agent.layout),
      avatar_shape: normalizeAvatarShape(agent.avatar_shape),
      background_style: normalizeAgentBackgroundStyle(agent.background_style),
      brand_colour: normalizeAgentBrandColour(agent.brand_colour),
      background_colour: normalizeHexColour(
        agent.background_colour,
        agency.primary_colour,
      ),
      text_colour: normalizeHexColour(agent.text_colour, "#ffffff"),
    },
  };
}

export function ensureSocialPostsDocument(
  document: SocialPostsDocumentJson,
): SocialPostsDocumentJson {
  const withAgent = {
    ...document,
    agent: { ...EMPTY_AGENT, ...document.agent },
  };

  let next = {
    ...ensurePerVariantLayers(migrateSocialPostVariants(withAgent)),
    listing: normalizeListingSlice(withAgent.listing),
  };

  const imagePool = imagePoolFromDocument({
    listingHeroUrl: next.listing.hero_image_url,
    variants: SOCIAL_POST_VARIANT_IDS.map((id) => next.variants[id]).filter(
      Boolean,
    ),
  });

  const nextVariants = { ...next.variants };
  for (const variantId of SOCIAL_POST_VARIANT_IDS) {
    const variant = nextVariants[variantId];
    if (!variant) continue;

    let migratedVariant = migrateVariantBackground(variant, imagePool);

    if (variant.layers) {
      migratedVariant = {
        ...migratedVariant,
        layers: normalizeSocialLayers(variant.layers, next.agency),
      };
    }

    nextVariants[variantId] = migratedVariant;
  }

  next = { ...next, variants: nextVariants };
  return {
    ...next,
    layers: getLayersForVariant(next, next.active_variant_id),
  };
}
