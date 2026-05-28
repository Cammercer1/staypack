import { getFormatTypographyProfile } from "@/lib/collateral/social/formatTypography";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import type { SocialPostTextAlign } from "@/lib/collateral/templates/types";

export const LOGO_SCALE_MIN = 0.5;
export const LOGO_SCALE_MAX = 2;
export const AGENT_SCALE_MIN = 0.1;
export const AGENT_SCALE_MAX = 2;
/** Gap between agent photo and text (0 = none, 1 = default, 2 = double). */
export const AGENT_INNER_GAP_SCALE_MIN = 0;
export const AGENT_INNER_GAP_SCALE_MAX = 2;
export const TEXT_SCALE_MIN = 0.6;
export const TEXT_SCALE_MAX = 2.5;
/** Text max line width as a fraction of the middle band (50%–100%). */
export const TEXT_BOX_WIDTH_SCALE_MIN = 0.5;
export const TEXT_BOX_WIDTH_SCALE_MAX = 1;
/** Extra inset within the middle band (0–100% of max inset per side). */
export const TEXT_ZONE_INSET_MIN = 0;
export const TEXT_ZONE_INSET_MAX = 1;
/** At 100% inset slider, consume up to this fraction of middle-band height per side. */
export const TEXT_ZONE_INSET_HEIGHT_FRACTION = 0.4;
export const TEXT_BOX_HEIGHT_SCALE_MIN = 0.5;
export const TEXT_BOX_HEIGHT_SCALE_MAX = 3;
/** Gap between headline, subcopy, and property details (0 = none, 1 = default, 3 = triple). */
export const TEXT_LINE_GAP_SCALE_MIN = 0;
export const TEXT_LINE_GAP_SCALE_MAX = 3;
const TEXT_LINE_GAP_REFERENCE_WIDTH = 1080;

export function normalizeLogoScale(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(LOGO_SCALE_MAX, Math.max(LOGO_SCALE_MIN, value));
}

/** Earlier builds defaulted agent scale to 0.1; treat as 100% when loading. */
const LEGACY_AGENT_DEFAULT_SCALE = 0.1;

export function normalizeAgentScale(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return 1;
  if (value === LEGACY_AGENT_DEFAULT_SCALE) return 1;
  return Math.min(AGENT_SCALE_MAX, Math.max(AGENT_SCALE_MIN, value));
}

export function normalizeAgentInnerGapScale(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(
    AGENT_INNER_GAP_SCALE_MAX,
    Math.max(AGENT_INNER_GAP_SCALE_MIN, value),
  );
}

export function normalizeTextScale(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, value));
}

export function normalizeTextBoxWidthScale(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return 1;
  // Legacy saves used 0.5–1.5 as line-width scale before band-fraction model.
  if (value > TEXT_BOX_WIDTH_SCALE_MAX) {
    const legacyMin = 0.5;
    const legacyMax = 1.5;
    const t = Math.min(legacyMax, Math.max(legacyMin, value));
    return (
      TEXT_BOX_WIDTH_SCALE_MIN +
      ((t - legacyMin) / (legacyMax - legacyMin)) *
        (TEXT_BOX_WIDTH_SCALE_MAX - TEXT_BOX_WIDTH_SCALE_MIN)
    );
  }
  return Math.min(
    TEXT_BOX_WIDTH_SCALE_MAX,
    Math.max(TEXT_BOX_WIDTH_SCALE_MIN, value),
  );
}

/** Map 0.5–1 width scale to 50–100 for UI labels. */
export function textBoxWidthScaleToPercent(scale: number) {
  const normalized = normalizeTextBoxWidthScale(scale);
  return Math.round(
    ((normalized - TEXT_BOX_WIDTH_SCALE_MIN) /
      (TEXT_BOX_WIDTH_SCALE_MAX - TEXT_BOX_WIDTH_SCALE_MIN)) *
      50 +
      50,
  );
}

export function normalizeTextLineGapScale(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(
    TEXT_LINE_GAP_SCALE_MAX,
    Math.max(TEXT_LINE_GAP_SCALE_MIN, value),
  );
}

export function getSocialPostLineGapPx(
  canvasWidth: number,
  variantId: SocialPostVariantId,
  lineGapScale: number | undefined,
) {
  const basePx = getFormatTypographyProfile(variantId).lineGapBasePx;
  const canvasScale = canvasWidth / TEXT_LINE_GAP_REFERENCE_WIDTH;
  return Math.max(
    0,
    Math.round(
      basePx * normalizeTextLineGapScale(lineGapScale) * canvasScale,
    ),
  );
}

export function normalizeTextZoneInset(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(
    TEXT_ZONE_INSET_MAX,
    Math.max(TEXT_ZONE_INSET_MIN, value),
  );
}

export function normalizeTextBoxHeightScale(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(
    TEXT_BOX_HEIGHT_SCALE_MAX,
    Math.max(TEXT_BOX_HEIGHT_SCALE_MIN, value),
  );
}

export function normalizeTextAlign(
  value: string | undefined,
): SocialPostTextAlign {
  if (value === "left" || value === "right" || value === "center") {
    return value;
  }
  return "center";
}
