import type { SocialPostVariantId } from "@/lib/collateral/social/formats";

export type SocialPostTextKind = "title" | "subcopy" | "features";

export type SocialPostTextTypography = {
  /** Font size at scale 1.0 (design pixels). */
  baseFontPx: number;
  minFontPx: number;
  /** Default layer `scale` for new / regenerated posts. */
  defaultScale: number;
};

export type SocialPostFormatTypographyProfile = {
  title: SocialPostTextTypography;
  subcopy: SocialPostTextTypography;
  features: SocialPostTextTypography;
  /** Line gap between copy lines at line_gap_scale 1. */
  lineGapBasePx: number;
};

/**
 * Per-format typography: scale sliders are relative to these bases, so 100% on
 * story is larger than 100% on wide even though both use the same scale field.
 */
export const SOCIAL_POST_FORMAT_TYPOGRAPHY: Record<
  SocialPostVariantId,
  SocialPostFormatTypographyProfile
> = {
  square: {
    title: { baseFontPx: 44, minFontPx: 14, defaultScale: 1 },
    subcopy: { baseFontPx: 24, minFontPx: 10, defaultScale: 1 },
    features: { baseFontPx: 20, minFontPx: 9, defaultScale: 1 },
    lineGapBasePx: 10,
  },
  wide: {
    title: { baseFontPx: 38, minFontPx: 12, defaultScale: 1 },
    subcopy: { baseFontPx: 20, minFontPx: 9, defaultScale: 1 },
    features: { baseFontPx: 17, minFontPx: 8, defaultScale: 1 },
    lineGapBasePx: 8,
  },
  story: {
    title: { baseFontPx: 58, minFontPx: 16, defaultScale: 1 },
    subcopy: { baseFontPx: 30, minFontPx: 11, defaultScale: 1 },
    features: { baseFontPx: 24, minFontPx: 10, defaultScale: 1 },
    lineGapBasePx: 12,
  },
};

const REFERENCE_WIDTH = 1080;

export function getFormatTypographyProfile(
  variantId: SocialPostVariantId,
): SocialPostFormatTypographyProfile {
  return SOCIAL_POST_FORMAT_TYPOGRAPHY[variantId];
}

export function getSocialPostTextTypography(
  variantId: SocialPostVariantId,
  kind: SocialPostTextKind,
): SocialPostTextTypography {
  return getFormatTypographyProfile(variantId)[kind];
}

/** Human-readable size for sliders (scale is relative to this format's base). */
export function formatTextScaleHint(
  variantId: SocialPostVariantId,
  kind: SocialPostTextKind,
  scale: number,
) {
  const { baseFontPx } = getSocialPostTextTypography(variantId, kind);
  const normalized = Math.min(2.5, Math.max(0.6, scale));
  const px = Math.round(baseFontPx * normalized);
  return `${Math.round(normalized * 100)}% ≈ ${px}px at export`;
}
