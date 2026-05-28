import { getSocialPostTextTypography } from "@/lib/collateral/social/formatTypography";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import {
  normalizeTextBoxHeightScale,
  normalizeTextBoxWidthScale,
  normalizeTextScale,
} from "@/lib/collateral/social/layerScale";
import { measureSocialPostTextBox } from "@/lib/collateral/social/socialPostTextMeasure";
import type { SocialPostTextLayer } from "@/lib/collateral/templates/types";

export type SocialPostTextLayerKind = "title" | "subcopy";

export function getSocialPostTextFontSize(options: {
  kind: SocialPostTextLayerKind;
  layer: SocialPostTextLayer;
  variantId: SocialPostVariantId;
}) {
  const typography = getSocialPostTextTypography(options.variantId, options.kind);
  const scale = normalizeTextScale(options.layer.scale);

  return Math.max(
    typography.minFontPx,
    Math.round(typography.baseFontPx * scale),
  );
}

export function getSocialPostTextLayerBox(options: {
  kind: SocialPostTextLayerKind;
  layer: SocialPostTextLayer;
  variantId: SocialPostVariantId;
  /** Full width of the text zone (100% of middle band). */
  maxWidthPx: number;
  fontFamily: string;
  fontWeight: number | string;
  lineHeightRatio?: number;
}) {
  const fontSize = getSocialPostTextFontSize({
    kind: options.kind,
    layer: options.layer,
    variantId: options.variantId,
  });
  const maxWidth = Math.max(
    1,
    Math.round(
      options.maxWidthPx * normalizeTextBoxWidthScale(options.layer.box_width_scale),
    ),
  );

  const measured = measureSocialPostTextBox({
    text: options.layer.text,
    fontSize,
    fontFamily: options.fontFamily,
    fontWeight: options.fontWeight,
    maxWidth,
    lineHeightRatio: options.lineHeightRatio,
  });

  const heightScale = normalizeTextBoxHeightScale(options.layer.box_height_scale);

  return {
    width: maxWidth,
    height: Math.max(
      Math.round(fontSize * 1.1),
      Math.round(measured.height * heightScale),
    ),
    fontSize,
  };
}
