import { defaultAgentLayerStyle } from "@/lib/collateral/social/agentStyle";
import {
  SOCIAL_POST_VARIANT_IDS,
  type SocialPostVariantId,
} from "@/lib/collateral/social/formats";
import {
  alignForTextCorner,
  migrateLayersToPresets,
} from "@/lib/collateral/social/presetPlacement";
import { getFormatTypographyProfile } from "@/lib/collateral/social/formatTypography";
import {
  defaultFeaturesEnabledForListing,
  defaultFeaturesLayer,
} from "@/lib/collateral/social/listingFeatures";
import { normalizeSocialLayers } from "@/lib/collateral/social/normalizeSocialDocument";
import type {
  CollateralAgentSlice,
  CollateralBrandSlice,
  CollateralListingSlice,
  SocialPostAgentLayer,
  SocialPostCorner,
  SocialPostCopyPlacement,
  SocialPostFeaturesLayer,
  SocialPostLogoLayer,
  SocialPostTextLayer,
  SocialPostsDocumentJson,
} from "@/lib/collateral/templates/types";

export type SocialPostLayers = SocialPostsDocumentJson["layers"];

type LayoutPreset = "story" | "square" | "landscape";

function layoutPresetForVariant(variantId: SocialPostVariantId): LayoutPreset {
  if (variantId === "story") return "story";
  if (variantId === "wide") return "landscape";
  return "square";
}

function baseTextLayer(
  text: string,
  overrides: Partial<SocialPostTextLayer>,
): SocialPostTextLayer {
  return {
    enabled: true,
    text,
    scale: 1,
    box_width_scale: 1,
    box_height_scale: 1,
    align: "left",
    block_placement: "bottom_left" as SocialPostCorner,
    zone_inset_top: 0,
    zone_inset_bottom: 0,
    line_gap_scale: 1,
    ...overrides,
  };
}

function baseLogoLayer(
  enabled: boolean,
  overrides: Partial<SocialPostLogoLayer>,
): SocialPostLogoLayer {
  return {
    enabled,
    placement: "top_left",
    scale: 1,
    colour: "original",
    ...overrides,
  };
}

function baseAgentLayer(
  agency: CollateralBrandSlice,
  overrides: Partial<SocialPostAgentLayer>,
): SocialPostAgentLayer {
  return {
    enabled: false,
    placement: "bottom_left" as SocialPostCopyPlacement,
    scale: 1,
    inner_gap_scale: 1,
    layout: "horizontal",
    avatar_shape: "circle",
    ...defaultAgentLayerStyle(agency),
    ...overrides,
  };
}

type PresetLayout = {
  logo: Partial<SocialPostLogoLayer>;
  title: Partial<SocialPostTextLayer>;
  subcopy: Partial<SocialPostTextLayer>;
  features: Partial<SocialPostFeaturesLayer>;
  agent: Partial<SocialPostAgentLayer>;
};

function presetLayoutForVariant(variantId: SocialPostVariantId): PresetLayout {
  const typography = getFormatTypographyProfile(variantId);
  return {
    logo: { placement: "top_left", scale: 1, colour: "original" },
    title: {
      block_placement: "bottom_left",
      align: "left",
      scale: typography.title.defaultScale,
      box_width_scale: 1,
      box_height_scale: 1,
    },
    subcopy: {
      block_placement: "bottom_left",
      align: "left",
      scale: typography.subcopy.defaultScale,
      box_width_scale: 1,
      box_height_scale: 1,
    },
    features: {
      enabled: false,
      show_bedrooms: true,
      show_bathrooms: true,
      show_car_spaces: true,
      show_land_area: true,
      scale: typography.features.defaultScale,
    },
    agent: {
      placement: "bottom_left",
      scale: 1,
      inner_gap_scale: 1,
      layout: "horizontal",
      background_style: "none",
    },
  };
}

const PRESET_LAYOUTS: Record<LayoutPreset, PresetLayout> = {
  story: presetLayoutForVariant("story"),
  square: presetLayoutForVariant("square"),
  landscape: presetLayoutForVariant("wide"),
};

export function buildDefaultVariantLayers(
  variantId: SocialPostVariantId,
  options: {
    address: string;
    agency: CollateralBrandSlice;
    agent: CollateralAgentSlice;
    listing?: CollateralListingSlice;
    content?: Partial<SocialPostLayers>;
  },
): SocialPostLayers {
  const { address, agency, content, listing } = options;
  const preset = layoutPresetForVariant(variantId);
  const layout = PRESET_LAYOUTS[preset];

  const titleText = content?.title?.text ?? address;
  const subcopyText = content?.subcopy?.text ?? "";
  const subcopyEnabled = content?.subcopy?.enabled ?? Boolean(subcopyText.trim());
  const agentEnabled = content?.agent?.enabled ?? false;

  const featuresDefaults = defaultFeaturesLayer(variantId, {
    ...layout.features,
    ...content?.features,
    enabled:
      content?.features?.enabled ??
      (listing ? defaultFeaturesEnabledForListing(listing) : false),
  });

  return normalizeSocialLayers(
    {
      logo: baseLogoLayer(Boolean(agency.logo_url), {
        ...layout.logo,
        ...content?.logo,
      }),
      title: baseTextLayer(titleText, {
        ...layout.title,
        ...content?.title,
        text: titleText,
      }),
      subcopy: baseTextLayer(subcopyText, {
        enabled: subcopyEnabled,
        block_placement:
          content?.title?.block_placement ??
          layout.title.block_placement ??
          "bottom_left",
        align: layout.title.align ?? "left",
        ...layout.subcopy,
        ...content?.subcopy,
        text: subcopyText,
      }),
      features: featuresDefaults,
      agent: baseAgentLayer(agency, {
        enabled: agentEnabled,
        ...layout.agent,
        ...content?.agent,
      }),
    },
    agency,
  );
}

export function getLayersForVariant(
  document: SocialPostsDocumentJson,
  variantId: SocialPostVariantId,
): SocialPostLayers {
  const variant = document.variants[variantId];
  if (variant?.layers) {
    return normalizeSocialLayers(variant.layers, document.agency);
  }

  return buildDefaultVariantLayers(variantId, {
    address: document.listing.address,
    agency: document.agency,
    agent: document.agent,
    listing: document.listing,
    content: migrateLayersToPresets(document.layers),
  });
}

/** Copy only content fields onto a variant; layout/style stays per format. */
function syncSharedLayerContent(
  layers: SocialPostLayers,
  source: SocialPostLayers,
): SocialPostLayers {
  return {
    logo: { ...layers.logo, enabled: source.logo.enabled },
    title: {
      ...layers.title,
      enabled: source.title.enabled,
      text: source.title.text,
    },
    subcopy: {
      ...layers.subcopy,
      enabled: source.subcopy.enabled,
      text: source.subcopy.text,
    },
    features: {
      ...layers.features,
      enabled: source.features.enabled,
      show_bedrooms: source.features.show_bedrooms,
      show_bathrooms: source.features.show_bathrooms,
      show_car_spaces: source.features.show_car_spaces,
      show_land_area: source.features.show_land_area,
    },
    agent: { ...layers.agent, enabled: source.agent.enabled },
  };
}

export function setVariantLayers(
  document: SocialPostsDocumentJson,
  variantId: SocialPostVariantId,
  layers: SocialPostLayers,
  options?: { layoutCustomized?: boolean },
): SocialPostsDocumentJson {
  const normalized = normalizeSocialLayers(layers, document.agency);
  const variant = document.variants[variantId];

  const nextVariants = {
    ...document.variants,
    [variantId]: {
      ...variant,
      layers: normalized,
      layout_customized: options?.layoutCustomized ?? true,
    },
  };

  const activeLayers =
    variantId === document.active_variant_id
      ? normalized
      : document.layers;

  return {
    ...document,
    variants: nextVariants,
    layers: activeLayers,
  };
}

export function syncSharedContentAcrossVariants(
  document: SocialPostsDocumentJson,
  sourceLayers: SocialPostLayers,
): SocialPostsDocumentJson {
  const nextVariants = { ...document.variants };

  for (const variantId of SOCIAL_POST_VARIANT_IDS) {
    const existing =
      nextVariants[variantId]?.layers ??
      getLayersForVariant(document, variantId);
    nextVariants[variantId] = {
      ...nextVariants[variantId],
      layers: syncSharedLayerContent(existing, sourceLayers),
    };
  }

  return {
    ...document,
    variants: nextVariants,
    layers: normalizeSocialLayers(sourceLayers, document.agency),
  };
}

const FEATURES_CONTENT_KEYS = [
  "enabled",
  "show_bedrooms",
  "show_bathrooms",
  "show_car_spaces",
  "show_land_area",
] as const satisfies readonly (keyof SocialPostFeaturesLayer)[];

function layerPatchTouchesSharedContent(
  patch: Partial<SocialPostLayers>,
): boolean {
  if (patch.logo && "enabled" in patch.logo) return true;

  if (
    patch.title &&
    ("enabled" in patch.title || "text" in patch.title)
  ) {
    return true;
  }

  if (
    patch.subcopy &&
    ("enabled" in patch.subcopy || "text" in patch.subcopy)
  ) {
    return true;
  }

  if (
    patch.features &&
    FEATURES_CONTENT_KEYS.some((key) => key in patch.features!)
  ) {
    return true;
  }

  if (patch.agent && "enabled" in patch.agent) return true;

  return false;
}

export function applyDocumentLayerUpdate(
  document: SocialPostsDocumentJson,
  patch: Partial<SocialPostLayers>,
  options?: { layoutCustomized?: boolean },
): SocialPostsDocumentJson {
  const activeId = document.active_variant_id;
  const current = getLayersForVariant(document, activeId);
  const merged = normalizeSocialLayers(
    {
      logo: { ...current.logo, ...patch.logo },
      title: { ...current.title, ...patch.title },
      subcopy: { ...current.subcopy, ...patch.subcopy },
      features: { ...current.features, ...patch.features },
      agent: { ...current.agent, ...patch.agent },
    },
    document.agency,
  );

  const withShared = layerPatchTouchesSharedContent(patch)
    ? syncSharedContentAcrossVariants(document, merged)
    : document;

  return setVariantLayers(withShared, activeId, merged, {
    layoutCustomized: options?.layoutCustomized ?? true,
  });
}

export function patchDocumentAgent(
  document: SocialPostsDocumentJson,
  agentPatch: Partial<CollateralAgentSlice>,
): SocialPostsDocumentJson {
  return { ...document, agent: { ...document.agent, ...agentPatch } };
}

export function patchDocumentListing(
  document: SocialPostsDocumentJson,
  listingPatch: Partial<CollateralListingSlice>,
): SocialPostsDocumentJson {
  return {
    ...document,
    listing: { ...document.listing, ...listingPatch },
  };
}

export function ensurePerVariantLayers(
  document: SocialPostsDocumentJson,
): SocialPostsDocumentJson {
  const hasAllLayers = SOCIAL_POST_VARIANT_IDS.every(
    (id) => document.variants[id]?.layers != null,
  );

  let next = document;

  if (!hasAllLayers) {
    const legacyContent = migrateLayersToPresets(document.layers);
    const nextVariants = { ...document.variants };

    for (const variantId of SOCIAL_POST_VARIANT_IDS) {
      if (nextVariants[variantId]?.layers) continue;

      nextVariants[variantId] = {
        ...nextVariants[variantId],
        layers: buildDefaultVariantLayers(variantId, {
          address: document.listing.address,
          agency: document.agency,
          agent: document.agent,
          listing: document.listing,
          content: legacyContent,
        }),
        layout_customized: false,
      };
    }

    next = { ...next, variants: nextVariants };
  }

  const activeLayers = getLayersForVariant(next, next.active_variant_id);

  return {
    ...next,
    layers: activeLayers,
  };
}

export function buildAllVariantStates(
  document: Omit<SocialPostsDocumentJson, "variants" | "layers"> & {
    variants: SocialPostsDocumentJson["variants"];
  },
  options: {
    address: string;
    agency: CollateralBrandSlice;
    agent: CollateralAgentSlice;
    logoEnabled: boolean;
  },
): SocialPostsDocumentJson["variants"] {
  const contentSeed: Partial<SocialPostLayers> = {
    logo: {
      enabled: options.logoEnabled,
      placement: "top_left",
      scale: 1,
      colour: "original",
    },
    title: {
      enabled: true,
      text: options.address,
      block_placement: "bottom_left",
      scale: 1,
      box_width_scale: 1,
      box_height_scale: 1,
      align: "left",
    },
    subcopy: {
      enabled: false,
      text: "",
      block_placement: "bottom_left",
      scale: 1,
      box_width_scale: 1,
      box_height_scale: 1,
      align: "left",
    },
    features: defaultFeaturesLayer("square"),
  };

  return SOCIAL_POST_VARIANT_IDS.reduce(
    (acc, variantId) => {
      acc[variantId] = {
        ...document.variants[variantId],
        layers: buildDefaultVariantLayers(variantId, {
          address: options.address,
          agency: options.agency,
          agent: options.agent,
          listing: document.listing,
          content: contentSeed,
        }),
        layout_customized: false,
      };
      return acc;
    },
    {} as SocialPostsDocumentJson["variants"],
  );
}

export { alignForTextCorner };
export type { SocialPostCopyPlacement, SocialPostCorner };
