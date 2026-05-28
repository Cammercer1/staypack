import {
  getFormatTypographyProfile,
  getSocialPostTextTypography,
} from "@/lib/collateral/social/formatTypography";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import {
  normalizeTextBoxWidthScale,
  normalizeTextScale,
} from "@/lib/collateral/social/layerScale";
import { measureSocialPostTextBox } from "@/lib/collateral/social/socialPostTextMeasure";
import type {
  CollateralListingSlice,
  SocialPostFeaturesLayer,
} from "@/lib/collateral/templates/types";
import type { Listing } from "@/lib/types";

export function defaultFeaturesLayer(
  variantId: SocialPostVariantId = "square",
  overrides?: Partial<SocialPostFeaturesLayer>,
): SocialPostFeaturesLayer {
  const defaultScale =
    getFormatTypographyProfile(variantId).features.defaultScale;
  return {
    enabled: false,
    show_bedrooms: true,
    show_bathrooms: true,
    show_car_spaces: true,
    show_land_area: true,
    scale: defaultScale,
    ...overrides,
  };
}

export function normalizeFeaturesLayer(
  layer: Partial<SocialPostFeaturesLayer> | undefined,
  variantId: SocialPostVariantId = "square",
): SocialPostFeaturesLayer {
  const base = defaultFeaturesLayer(variantId);
  if (!layer) return base;
  return {
    enabled: Boolean(layer.enabled),
    show_bedrooms: layer.show_bedrooms ?? base.show_bedrooms,
    show_bathrooms: layer.show_bathrooms ?? base.show_bathrooms,
    show_car_spaces: layer.show_car_spaces ?? base.show_car_spaces,
    show_land_area: layer.show_land_area ?? base.show_land_area,
    scale: normalizeTextScale(layer.scale ?? base.scale),
  };
}

export function migrateFeaturesLayer(
  layer: Partial<SocialPostFeaturesLayer> | undefined,
  variantId: SocialPostVariantId = "square",
): SocialPostFeaturesLayer {
  return normalizeFeaturesLayer(layer, variantId);
}

function formatCount(value: number, singular: string, plural: string) {
  const n = Math.round(value);
  if (n === 1) return `1 ${singular}`;
  return `${n} ${plural}`;
}

export function formatLandAreaSqm(value: number) {
  const n = Math.round(value);
  return `${n.toLocaleString("en-AU")} m²`;
}

export function formatListingFeaturesLine(
  listing: CollateralListingSlice,
  layer: SocialPostFeaturesLayer,
): string {
  const parts: string[] = [];

  if (
    layer.show_bedrooms &&
    listing.bedrooms != null &&
    !Number.isNaN(listing.bedrooms)
  ) {
    parts.push(formatCount(listing.bedrooms, "bed", "beds"));
  }
  if (
    layer.show_bathrooms &&
    listing.bathrooms != null &&
    !Number.isNaN(listing.bathrooms)
  ) {
    parts.push(formatCount(listing.bathrooms, "bath", "baths"));
  }
  if (
    layer.show_car_spaces &&
    listing.car_spaces != null &&
    !Number.isNaN(listing.car_spaces)
  ) {
    parts.push(formatCount(listing.car_spaces, "car", "cars"));
  }
  if (
    layer.show_land_area &&
    listing.land_area_sqm != null &&
    listing.land_area_sqm > 0 &&
    !Number.isNaN(listing.land_area_sqm)
  ) {
    parts.push(formatLandAreaSqm(listing.land_area_sqm));
  }

  return parts.join(" · ");
}

export function listingHasFeatureStats(listing: CollateralListingSlice) {
  return (
    listing.bedrooms != null ||
    listing.bathrooms != null ||
    listing.car_spaces != null ||
    (listing.land_area_sqm != null && listing.land_area_sqm > 0)
  );
}

export function featuresLineWouldRender(
  listing: CollateralListingSlice,
  layer: SocialPostFeaturesLayer,
) {
  return layer.enabled && formatListingFeaturesLine(listing, layer).length > 0;
}

export function defaultFeaturesEnabledForListing(
  listing: CollateralListingSlice,
): boolean {
  return listingHasFeatureStats(listing);
}

export function listingStatsFromListing(
  listing: Listing,
): Pick<
  CollateralListingSlice,
  "bedrooms" | "bathrooms" | "car_spaces" | "land_area_sqm"
> {
  const scraped = listing.scraped_listing_json;
  return {
    bedrooms: listing.bedrooms ?? scraped?.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? scraped?.bathrooms ?? null,
    car_spaces: listing.car_spaces ?? scraped?.carSpaces ?? null,
    land_area_sqm: null,
  };
}

export function mergeListingSliceStats(
  current: CollateralListingSlice,
  listing: Listing,
): CollateralListingSlice {
  const stats = listingStatsFromListing(listing);
  return {
    ...current,
    bedrooms: stats.bedrooms,
    bathrooms: stats.bathrooms,
    car_spaces: stats.car_spaces,
    land_area_sqm: current.land_area_sqm ?? stats.land_area_sqm,
  };
}

export function normalizeListingSlice(
  listing: CollateralListingSlice,
): CollateralListingSlice {
  return {
    ...listing,
    bedrooms: coerceOptionalNumber(listing.bedrooms),
    bathrooms: coerceOptionalNumber(listing.bathrooms),
    car_spaces: coerceOptionalNumber(listing.car_spaces),
    land_area_sqm: coerceOptionalNumber(listing.land_area_sqm),
  };
}

function coerceOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getSocialPostFeaturesFontSize(options: {
  layer: SocialPostFeaturesLayer;
  variantId: SocialPostVariantId;
}) {
  const typography = getSocialPostTextTypography(options.variantId, "features");
  const scale = normalizeTextScale(options.layer.scale);
  return Math.max(
    typography.minFontPx,
    Math.round(typography.baseFontPx * scale),
  );
}

export function getSocialPostFeaturesLayerBox(options: {
  line: string;
  layer: SocialPostFeaturesLayer;
  variantId: SocialPostVariantId;
  maxWidthPx: number;
  fontFamily: string;
  /** Shared with headline/subcopy (title.box_width_scale). */
  boxWidthScale?: number;
}) {
  const fontSize = getSocialPostFeaturesFontSize({
    layer: options.layer,
    variantId: options.variantId,
  });
  const maxWidth = Math.max(
    1,
    Math.round(
      options.maxWidthPx *
        normalizeTextBoxWidthScale(options.boxWidthScale),
    ),
  );

  const measured = measureSocialPostTextBox({
    text: options.line,
    fontSize,
    fontFamily: options.fontFamily,
    fontWeight: 500,
    maxWidth,
    lineHeightRatio: 1.2,
  });

  return {
    width: maxWidth,
    height: Math.max(Math.round(fontSize * 1.1), measured.height),
    fontSize,
  };
}
