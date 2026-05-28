import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import {
  normalizeAgentInnerGapScale,
  normalizeAgentScale,
} from "@/lib/collateral/social/layerScale";
import type {
  CollateralAgentSlice,
  SocialPostAgentLayout,
  SocialPostAvatarShape,
  SocialPostCopyPlacement,
  SocialPostTextAlign,
} from "@/lib/collateral/templates/types";

/** Vertical stack alignment from bottom position (left / center / right). */
export function agentContentAlignFromPlacement(
  placement: SocialPostCopyPlacement,
): SocialPostTextAlign {
  if (placement === "bottom_center") return "center";
  if (placement === "bottom_right") return "right";
  return "left";
}

export function normalizeAgentLayout(
  value: string | undefined,
): SocialPostAgentLayout {
  return value === "horizontal" ? "horizontal" : "vertical";
}

export function normalizeAvatarShape(
  value: string | undefined,
): SocialPostAvatarShape {
  return value === "square" ? "square" : "circle";
}

const REFERENCE_WIDTH = 1080;

/** Calibrated so agent block at scale 1 feels right next to default headline size. */
export function getAgentFormatProfile(variantId: SocialPostVariantId) {
  if (variantId === "story") {
    return {
      baseAvatarPx: 80,
      nameFontRatio: 0.38,
      detailFontRatio: 0.3,
    };
  }

  if (variantId === "wide") {
    return {
      baseAvatarPx: 54,
      nameFontRatio: 0.36,
      detailFontRatio: 0.28,
    };
  }

  return {
    baseAvatarPx: 64,
    nameFontRatio: 0.37,
    detailFontRatio: 0.29,
  };
}

export function getAgentFontSizes(avatarSize: number, variantId: SocialPostVariantId) {
  const profile = getAgentFormatProfile(variantId);
  return {
    nameSize: Math.max(11, Math.round(avatarSize * profile.nameFontRatio)),
    detailSize: Math.max(10, Math.round(avatarSize * profile.detailFontRatio)),
  };
}

export function getAgentInnerGapPx(options: {
  layout: SocialPostAgentLayout;
  scale: number;
  innerGapScale?: number;
  canvasWidth: number;
}) {
  const canvasScale = options.canvasWidth / REFERENCE_WIDTH;
  const basePx = options.layout === "horizontal" ? 16 : 12;
  return Math.round(
    basePx *
      normalizeAgentInnerGapScale(options.innerGapScale) *
      normalizeAgentScale(options.scale) *
      canvasScale,
  );
}

export function getAgentBlockDimensions(
  layout: SocialPostAgentLayout,
  scale: number,
  canvasWidth: number,
  agent: CollateralAgentSlice,
  variantId: SocialPostVariantId,
  innerGapScale?: number,
) {
  const profile = getAgentFormatProfile(variantId);
  const canvasScale = canvasWidth / REFERENCE_WIDTH;
  const avatarSize = Math.round(
    profile.baseAvatarPx * normalizeAgentScale(scale) * canvasScale,
  );

  const nameLine = agent.name
    ? Math.round(avatarSize * profile.nameFontRatio) + 6
    : 0;
  const detailLine = Math.round(avatarSize * profile.detailFontRatio) + 2;
  const phoneLine = agent.phone ? detailLine : 0;
  const emailLine = agent.email ? detailLine : 0;
  const textBlockHeight = nameLine + phoneLine + emailLine;
  const gap = getAgentInnerGapPx({
    layout,
    scale,
    innerGapScale,
    canvasWidth,
  });
  const padding = Math.round(10 * scale * canvasScale);

  if (layout === "horizontal") {
    const width = Math.min(
      Math.round(canvasWidth * 0.92),
      avatarSize + gap + Math.round(canvasWidth * 0.55) + padding * 2,
    );
    const height =
      padding * 2 + Math.max(avatarSize, textBlockHeight || detailLine);
    return { width, height, avatarSize, innerGapPx: gap };
  }

  const width = Math.min(
    Math.round(canvasWidth * 0.78),
    Math.round(260 * canvasScale * scale),
  );
  const height =
    padding * 2 +
    avatarSize +
    (textBlockHeight > 0 ? gap + textBlockHeight : 0);
  return { width, height, avatarSize, innerGapPx: gap };
}
