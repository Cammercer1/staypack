import { getAgentBlockDimensions, normalizeAgentLayout } from "@/lib/collateral/social/agentLayer";
import {
  normalizeAgentInnerGapScale,
  normalizeAgentScale,
  normalizeLogoScale,
  normalizeTextAlign,
  getSocialPostLineGapPx,
  normalizeTextBoxWidthScale,
  normalizeTextZoneInset,
  TEXT_ZONE_INSET_HEIGHT_FRACTION,
} from "@/lib/collateral/social/layerScale";
import { getSocialPostFormat } from "@/lib/collateral/social/formats";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import { normalizeLogoColour } from "@/lib/collateral/social/logoColour";
import {
  featuresLineWouldRender,
  formatListingFeaturesLine,
  getSocialPostFeaturesLayerBox,
  migrateFeaturesLayer,
} from "@/lib/collateral/social/listingFeatures";
import { getSocialPostTextLayerBox } from "@/lib/collateral/social/socialPostTextLayerBox";
import type { CollateralListingSlice } from "@/lib/collateral/templates/types";
import type { CollateralAgentSlice } from "@/lib/collateral/templates/types";
import type {
  SocialPostAgentLayer,
  SocialPostCopyPlacement,
  SocialPostCorner,
  SocialPostLayers,
  SocialPostLogoLayer,
  SocialPostTextLayer,
} from "@/lib/collateral/templates/types";

export const SOCIAL_POST_CORNERS: SocialPostCorner[] = [
  "top_left",
  "top_right",
  "bottom_left",
  "bottom_right",
];

export const SOCIAL_POST_COPY_PLACEMENTS: SocialPostCopyPlacement[] = [
  "bottom_left",
  "bottom_center",
  "bottom_right",
];

export type SocialPostTopCorner = "top_left" | "top_right";

export function normalizeCorner(
  value: string | undefined,
  fallback: SocialPostCorner = "top_left",
): SocialPostCorner {
  if (value && SOCIAL_POST_CORNERS.includes(value as SocialPostCorner)) {
    return value as SocialPostCorner;
  }
  return fallback;
}

/** Logo always lives in a top corner. */
export function normalizeLogoPlacement(
  value: string | undefined,
  fallback: SocialPostTopCorner = "top_left",
): SocialPostTopCorner {
  if (value === "top_right" || value === "bottom_right") return "top_right";
  if (value === "top_left" || value === "bottom_left") return "top_left";
  return fallback;
}

export function normalizeCopyPlacement(
  value: string | undefined,
  fallback: SocialPostCopyPlacement = "bottom_left",
): SocialPostCopyPlacement {
  if (
    value &&
    SOCIAL_POST_COPY_PLACEMENTS.includes(value as SocialPostCopyPlacement)
  ) {
    return value as SocialPostCopyPlacement;
  }
  return fallback;
}

/** Agent sits along the bottom edge (left, center, or right). */
export function normalizeAgentPlacement(
  value: string | undefined,
  fallback: SocialPostCopyPlacement = "bottom_left",
): SocialPostCopyPlacement {
  if (!value) return fallback;
  if (value === "bottom_center") return "bottom_center";
  if (value === "top_left" || value === "bottom_left") return "bottom_left";
  if (value === "top_right" || value === "bottom_right") return "bottom_right";
  return normalizeCopyPlacement(value, fallback);
}

/** Map legacy x/y (center %) to nearest corner. */
export function cornerFromLegacyPosition(x: number, y: number): SocialPostCorner {
  const horizontal = x < 50 ? "left" : "right";
  const vertical = y < 50 ? "top" : "bottom";
  return `${vertical}_${horizontal}` as SocialPostCorner;
}

export function migrateLogoLayer(logo: SocialPostLogoLayer): SocialPostLogoLayer {
  if (logo.placement) {
    return {
      ...logo,
      placement: normalizeLogoPlacement(logo.placement, "top_left"),
      scale: normalizeLogoScale(logo.scale),
      colour: normalizeLogoColour(logo.colour),
    };
  }
  const legacy = logo as SocialPostLogoLayer & { x?: number; y?: number };
  const x = legacy.x ?? 10;
  const y = legacy.y ?? 10;
  return {
    enabled: logo.enabled,
    placement: normalizeLogoPlacement(cornerFromLegacyPosition(x, y), "top_left"),
    scale: normalizeLogoScale(logo.scale),
    colour: normalizeLogoColour(logo.colour),
  };
}

function placementFromLegacyAgent(agent: SocialPostAgentLayer): SocialPostCopyPlacement {
  let placement = normalizeAgentPlacement(agent.placement, "bottom_left");

  if (agent.vertical_align === "center" && placement !== "bottom_center") {
    placement = "bottom_center";
  } else if (agent.vertical_align === "right" && placement === "bottom_left") {
    placement = "bottom_right";
  } else if (agent.vertical_align === "left" && placement === "bottom_right") {
    placement = "bottom_left";
  }

  return placement;
}

export function migrateAgentLayer(
  agent: SocialPostAgentLayer,
): SocialPostAgentLayer {
  const legacy = agent as SocialPostAgentLayer & { x?: number; y?: number };
  const x = legacy.x ?? 50;
  const y = legacy.y ?? 72;

  let placement = agent.placement
    ? placementFromLegacyAgent(agent)
    : y >= 50 && x >= 38 && x <= 62
      ? "bottom_center"
      : normalizeAgentPlacement(cornerFromLegacyPosition(x, y), "bottom_left");

  if (!agent.placement && agent.vertical_align) {
    placement = placementFromLegacyAgent({ ...agent, placement });
  }

  const {
    vertical_align: _legacyAlign,
    x: _legacyX,
    y: _legacyY,
    ...rest
  } = agent as SocialPostAgentLayer & {
    vertical_align?: string;
    x?: number;
    y?: number;
  };

  return {
    ...rest,
    placement,
    scale: normalizeAgentScale(agent.scale),
    inner_gap_scale: normalizeAgentInnerGapScale(agent.inner_gap_scale),
  };
}

export function migrateTextLayer(
  layer: SocialPostTextLayer,
  options: {
    defaultPlacement: SocialPostCorner;
    inheritPlacement?: SocialPostCorner;
  },
): SocialPostTextLayer {
  const legacy = layer as SocialPostTextLayer & { x?: number; y?: number };
  const blockPlacement = layer.block_placement
    ? normalizeCorner(layer.block_placement, options.defaultPlacement)
    : options.inheritPlacement ??
      cornerFromLegacyPosition(legacy.x ?? 50, legacy.y ?? 75);

  return {
    enabled: layer.enabled,
    text: layer.text,
    scale: layer.scale,
    align: normalizeTextAlign(layer.align),
    block_placement: blockPlacement,
    box_width_scale: layer.box_width_scale ?? 1,
    box_height_scale: layer.box_height_scale ?? 1,
    zone_inset_top: layer.zone_inset_top ?? 0,
    zone_inset_bottom: layer.zone_inset_bottom ?? 0,
    line_gap_scale: layer.line_gap_scale ?? 1,
  };
}

export function migrateLayersToPresets(layers: SocialPostLayers): SocialPostLayers {
  const title = migrateTextLayer(layers.title, {
    defaultPlacement: "bottom_left",
  });
  return {
    logo: migrateLogoLayer(layers.logo),
    title,
    subcopy: migrateTextLayer(layers.subcopy, {
      defaultPlacement: "bottom_left",
      inheritPlacement: title.block_placement,
    }),
    features: migrateFeaturesLayer(layers.features),
    agent: migrateAgentLayer(layers.agent),
  };
}

export type PresetLayerRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PresetCopyBlockLayout = {
  placement: SocialPostCorner;
  left: number;
  top: number;
  width: number;
  height: number;
  title: PresetLayerRect | null;
  subcopy: PresetLayerRect | null;
  features: PresetLayerRect | null;
};

export type PresetLayoutResult = {
  logo: PresetLayerRect | null;
  agent: PresetLayerRect | null;
  copyBlock: PresetCopyBlockLayout | null;
};

type ZoneRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function marginPx(canvasWidth: number, canvasHeight: number) {
  return {
    x: Math.round(canvasWidth * 0.04),
    y: Math.round(canvasHeight * 0.04),
  };
}

function logoDimensions(
  variantId: SocialPostVariantId,
  canvasWidth: number,
  canvasHeight: number,
  logoScale: number,
) {
  const format = getSocialPostFormat(variantId);
  const scale = normalizeLogoScale(logoScale);

  if (variantId === "story") {
    return {
      width: Math.round(canvasWidth * 0.38 * scale),
      height: Math.round(canvasWidth * 0.13 * scale),
    };
  }

  if (variantId === "wide") {
    return {
      width: Math.round(canvasWidth * 0.34 * scale),
      height: Math.round(canvasHeight * 0.22 * scale),
    };
  }

  return {
    width: Math.round(canvasWidth * 0.4 * scale),
    height: Math.round(canvasHeight * 0.12 * scale),
  };
}

function horizontalLeft(
  isLeft: boolean,
  zone: ZoneRect,
  elementWidth: number,
) {
  return isLeft
    ? zone.left
    : Math.max(zone.left, zone.left + zone.width - elementWidth);
}

function placeLogoRect(options: {
  placement: SocialPostTopCorner;
  width: number;
  height: number;
  canvasWidth: number;
  margin: { x: number; y: number };
}): PresetLayerRect {
  const { placement, width, height, canvasWidth, margin } = options;
  const isLeft = placement === "top_left";
  return {
    left: horizontalLeft(isLeft, {
      left: margin.x,
      top: margin.y,
      width: canvasWidth - margin.x * 2,
      height: 0,
    }, width),
    top: margin.y,
    width,
    height,
  };
}

function placeAgentRect(options: {
  placement: SocialPostCopyPlacement;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
  margin: { x: number; y: number };
}): PresetLayerRect {
  const { placement, width, height, canvasWidth, canvasHeight, margin } =
    options;
  const zone = {
    left: margin.x,
    top: 0,
    width: canvasWidth - margin.x * 2,
    height: 0,
  };

  let left: number;
  if (placement === "bottom_center") {
    left = Math.max(zone.left, zone.left + (zone.width - width) / 2);
  } else {
    left = horizontalLeft(placement === "bottom_left", zone, width);
  }

  return {
    left,
    top: canvasHeight - margin.y - height,
    width,
    height,
  };
}

function middleZone(options: {
  canvasWidth: number;
  canvasHeight: number;
  margin: { x: number; y: number };
  gap: number;
  logo: PresetLayerRect | null;
  agent: PresetLayerRect | null;
}): ZoneRect {
  const { canvasWidth, canvasHeight, margin, gap, logo, agent } = options;
  let top = margin.y;
  let bottom = canvasHeight - margin.y;

  if (logo) {
    top = Math.max(top, logo.top + logo.height + gap);
  }
  if (agent) {
    bottom = Math.min(bottom, agent.top - gap);
  }

  const height = Math.max(1, bottom - top);

  return {
    left: margin.x,
    top,
    width: canvasWidth - margin.x * 2,
    height,
  };
}

function middleZoneWithTextInsets(
  middle: ZoneRect,
  insetTop: number | undefined,
  insetBottom: number | undefined,
): ZoneRect {
  const topScale = normalizeTextZoneInset(insetTop);
  const bottomScale = normalizeTextZoneInset(insetBottom);
  const topPad = Math.round(
    middle.height * topScale * TEXT_ZONE_INSET_HEIGHT_FRACTION,
  );
  const bottomPad = Math.round(
    middle.height * bottomScale * TEXT_ZONE_INSET_HEIGHT_FRACTION,
  );

  return {
    left: middle.left,
    top: middle.top + topPad,
    width: middle.width,
    height: Math.max(1, middle.height - topPad - bottomPad),
  };
}

/** Place headline+subcopy block in a corner of the middle band. */
function placeTextBlockInMiddle(options: {
  middle: ZoneRect;
  placement: SocialPostCorner;
  blockWidth: number;
  blockHeight: number;
  align: ReturnType<typeof normalizeTextAlign>;
}): PresetLayerRect {
  const { middle, placement, blockWidth, blockHeight, align } = options;
  const anchorTop = placement.startsWith("top");

  let left = middle.left;
  if (align === "center") {
    left = Math.round(middle.left + (middle.width - blockWidth) / 2);
  } else if (align === "right") {
    left = middle.left + middle.width - blockWidth;
  }

  return {
    left,
    top: anchorTop
      ? middle.top
      : Math.max(middle.top, middle.top + middle.height - blockHeight),
    width: blockWidth,
    height: blockHeight,
  };
}

type CopyLineBox = { height: number } | null;

function layoutCopyLines(options: {
  block: PresetLayerRect;
  placement: SocialPostCorner;
  titleBox: CopyLineBox;
  subcopyBox: CopyLineBox;
  featuresBox: CopyLineBox;
  titleEnabled: boolean;
  subcopyEnabled: boolean;
  featuresEnabled: boolean;
  innerGap: number;
}): Pick<PresetCopyBlockLayout, "title" | "subcopy" | "features"> {
  const {
    block,
    placement,
    titleBox,
    subcopyBox,
    featuresBox,
    titleEnabled,
    subcopyEnabled,
    featuresEnabled,
    innerGap,
  } = options;

  const anchorTop = placement.startsWith("top");
  const segments: {
    key: "title" | "subcopy" | "features";
    height: number;
    enabled: boolean;
  }[] = [
    {
      key: "title",
      height: titleBox?.height ?? 0,
      enabled: titleEnabled && Boolean(titleBox),
    },
    {
      key: "subcopy",
      height: subcopyBox?.height ?? 0,
      enabled: subcopyEnabled && Boolean(subcopyBox),
    },
    {
      key: "features",
      height: featuresBox?.height ?? 0,
      enabled: featuresEnabled && Boolean(featuresBox),
    },
  ];

  const active = segments.filter((s) => s.enabled && s.height > 0);
  const result: Pick<PresetCopyBlockLayout, "title" | "subcopy" | "features"> = {
    title: null,
    subcopy: null,
    features: null,
  };

  if (active.length === 0) return result;

  if (anchorTop) {
    let y = block.top;
    for (let i = 0; i < active.length; i++) {
      const seg = active[i];
      result[seg.key] = {
        left: block.left,
        top: y,
        width: block.width,
        height: seg.height,
      };
      y += seg.height;
      if (i < active.length - 1) y += innerGap;
    }
    return result;
  }

  let y = block.top + block.height;
  for (let i = active.length - 1; i >= 0; i--) {
    const seg = active[i];
    y -= seg.height;
    result[seg.key] = {
      left: block.left,
      top: y,
      width: block.width,
      height: seg.height,
    };
    if (i > 0) y -= innerGap;
  }

  return result;
}

export function computePresetLayout(options: {
  layers: SocialPostLayers;
  listing: CollateralListingSlice;
  variantId: SocialPostVariantId;
  canvasWidth: number;
  canvasHeight: number;
  logoUrl: string | null;
  agent: CollateralAgentSlice;
  fonts?: { headingFontFamily: string; bodyFontFamily: string };
}): PresetLayoutResult {
  const { layers, listing, variantId, canvasWidth, canvasHeight, logoUrl, agent, fonts } =
    options;
  const format = getSocialPostFormat(variantId);
  const margin = marginPx(canvasWidth, canvasHeight);
  const gap = Math.round(10 * (canvasWidth / 1080));
  const headingFont = fonts?.headingFontFamily ?? "Georgia, serif";
  const bodyFont = fonts?.bodyFontFamily ?? "system-ui, sans-serif";

  const result: PresetLayoutResult = {
    logo: null,
    agent: null,
    copyBlock: null,
  };

  if (layers.logo.enabled && logoUrl) {
    const logoSize = logoDimensions(
      variantId,
      canvasWidth,
      canvasHeight,
      layers.logo.scale,
    );
    result.logo = placeLogoRect({
      placement: normalizeLogoPlacement(layers.logo.placement, "top_left"),
      width: logoSize.width,
      height: logoSize.height,
      canvasWidth,
      margin,
    });
  }

  const agentLayer = layers.agent;
  if (agentLayer?.enabled) {
    const dims = getAgentBlockDimensions(
      normalizeAgentLayout(agentLayer.layout),
      normalizeAgentScale(agentLayer.scale),
      canvasWidth,
      agent,
      variantId,
      agentLayer.inner_gap_scale,
    );
    result.agent = placeAgentRect({
      placement: normalizeAgentPlacement(agentLayer.placement, "bottom_left"),
      width: dims.width,
      height: dims.height,
      canvasWidth,
      canvasHeight,
      margin,
    });
  }

  const textPlacement = normalizeCorner(
    layers.title.block_placement,
    "bottom_left",
  );
  const titleEnabled =
    layers.title.enabled && Boolean(layers.title.text.trim());
  const subcopyEnabled =
    layers.subcopy.enabled && Boolean(layers.subcopy.text.trim());
  const featuresEnabled = featuresLineWouldRender(listing, layers.features);
  const featuresLine = featuresEnabled
    ? formatListingFeaturesLine(listing, layers.features)
    : "";

  if (titleEnabled || subcopyEnabled || featuresEnabled) {
    const middle = middleZoneWithTextInsets(
      middleZone({
        canvasWidth,
        canvasHeight,
        margin,
        gap,
        logo: result.logo,
        agent: result.agent,
      }),
      layers.title.zone_inset_top,
      layers.title.zone_inset_bottom,
    );

    const maxTextWidth = middle.width;

    let titleBox: ReturnType<typeof getSocialPostTextLayerBox> | null = null;
    let subcopyBox: ReturnType<typeof getSocialPostTextLayerBox> | null = null;
    let featuresBox: ReturnType<typeof getSocialPostFeaturesLayerBox> | null =
      null;

    const textWidthScale = normalizeTextBoxWidthScale(
      layers.title.box_width_scale,
    );

    if (titleEnabled) {
      titleBox = getSocialPostTextLayerBox({
        kind: "title",
        layer: { ...layers.title, box_width_scale: textWidthScale },
        variantId,
        maxWidthPx: maxTextWidth,
        fontFamily: headingFont,
        fontWeight: 700,
        lineHeightRatio: 1.15,
      });
    }

    if (subcopyEnabled) {
      subcopyBox = getSocialPostTextLayerBox({
        kind: "subcopy",
        layer: { ...layers.subcopy, box_width_scale: textWidthScale },
        variantId,
        maxWidthPx: maxTextWidth,
        fontFamily: bodyFont,
        fontWeight: 400,
        lineHeightRatio: 1.2,
      });
    }

    if (featuresEnabled) {
      featuresBox = getSocialPostFeaturesLayerBox({
        line: featuresLine,
        layer: layers.features,
        variantId,
        maxWidthPx: maxTextWidth,
        fontFamily: bodyFont,
        boxWidthScale: textWidthScale,
      });
    }

    const blockWidth = Math.max(
      titleBox?.width ?? 0,
      subcopyBox?.width ?? 0,
      featuresBox?.width ?? 0,
      1,
    );
    const innerGap = getSocialPostLineGapPx(
      canvasWidth,
      variantId,
      layers.title.line_gap_scale,
    );
    const lineHeights = [
      titleEnabled ? titleBox?.height ?? 0 : 0,
      subcopyEnabled ? subcopyBox?.height ?? 0 : 0,
      featuresEnabled ? featuresBox?.height ?? 0 : 0,
    ].filter((h) => h > 0);
    const blockHeight =
      lineHeights.reduce((sum, h) => sum + h, 0) +
      Math.max(0, lineHeights.length - 1) * innerGap;

    const block = placeTextBlockInMiddle({
      middle,
      placement: textPlacement,
      blockWidth,
      blockHeight,
      align: normalizeTextAlign(layers.title.align),
    });

    const lines = layoutCopyLines({
      block,
      placement: textPlacement,
      titleBox,
      subcopyBox,
      featuresBox,
      titleEnabled,
      subcopyEnabled,
      featuresEnabled,
      innerGap,
    });

    result.copyBlock = {
      placement: textPlacement,
      ...block,
      ...lines,
    };
  }

  return result;
}

export function alignForTextCorner(
  corner: SocialPostCorner,
): "left" | "right" {
  return corner.endsWith("_right") ? "right" : "left";
}
