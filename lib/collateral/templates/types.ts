import type { ComponentType } from "react";
import type { BusinessCardVariantId } from "@/lib/collateral/business-card/formats";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import type { AgencyBrandAdvanced, CollateralType, ListingImageMetaMap } from "@/lib/types";

export type CollateralPageFormatId =
  | "a4-portrait"
  | "a4-landscape"
  | "business-card-au";

export type CollateralBrandSlice = {
  name: string;
  logo_url: string;
  logo_light_url: string;
  logo_dark_url: string;
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  text_colour: string;
  callout_heading_colour?: string | null;
  callout_text_colour?: string | null;
  background_colour: string;
  heading_font_family: string;
  body_font_family: string;
  font_family: string;
  heading_font_file_url: string;
  body_font_file_url: string;
  font_file_url: string;
  website_url: string;
  email: string;
  phone: string;
  brand_advanced?: AgencyBrandAdvanced | null;
};

export type CollateralAgentSlice = {
  name: string;
  role_title: string;
  phone: string;
  email: string;
  photo_url: string;
};

export type CollateralListingSlice = {
  address: string;
  suburb: string;
  display_price: string;
  hero_image_url: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  car_spaces?: number | null;
  land_area_sqm?: number | null;
};

/** Property stats row under subcopy (beds, baths, etc.). */
export type SocialPostFeaturesLayer = {
  enabled: boolean;
  show_bedrooms: boolean;
  show_bathrooms: boolean;
  show_car_spaces: boolean;
  show_land_area: boolean;
  /** Multiplier on format default features font size. */
  scale: number;
};

export type BusinessCardDocumentJson = {
  version: "business_card_v1";
  type: "agent_business_card";
  template_id: string;
  generated_at: string;
  agency: CollateralBrandSlice;
  agent_profile_id?: string | null;
  listing: CollateralListingSlice | null;
  agent: CollateralAgentSlice;
  active_variant_id: BusinessCardVariantId;
  variants: Record<BusinessCardVariantId, BusinessCardVariantState>;
  qr_listing_id?: string | null;
  qr_target_url?: string;
  assets: {
    qr_code_url?: string;
  };
};

export type BusinessCardVariantState = {
  headline: string;
  subcopy: string;
  show_logo: boolean;
  show_agent_photo: boolean;
  show_contact: boolean;
  show_agency_details: boolean;
  show_qr: boolean;
  background_style: "light" | "brand";
  layers: BusinessCardLayers;
  /** Back-side only: which back template to use. */
  back_style?: "colour" | "photo";
  /** Back-side only: hex colour override (falls back to agency primary). */
  back_colour?: string;
  /** Back-side only: which corner to place the QR code (legacy; layers.qr.x/y used instead). */
  qr_corner?: "bottom_left" | "bottom_right";
  /** Back-side only: which logo variant to use. */
  back_logo_variant?: "light" | "dark" | "custom";
  /** Back-side only: custom logo URL when back_logo_variant === "custom". */
  back_logo_custom_url?: string;
};

export type BusinessCardLayerState = {
  enabled: boolean;
  /** Horizontal position as percentage of card width. */
  x: number;
  /** Vertical position as percentage of card height. */
  y: number;
  /** Size multiplier for the layer. */
  scale: number;
  /** Optional content width as percentage of card width. */
  width: number;
};

export type BusinessCardLayers = {
  logo: BusinessCardLayerState;
  headline: BusinessCardLayerState;
  subcopy: BusinessCardLayerState;
  agent_photo: BusinessCardLayerState;
  agent_contact: BusinessCardLayerState;
  qr: BusinessCardLayerState;
  agency_details: BusinessCardLayerState;
};

export type SocialPostTextAlign = "left" | "center" | "right";

export type SocialPostCorner =
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right";

export type SocialPostCopyPlacement =
  | "bottom_left"
  | "bottom_center"
  | "bottom_right";

export type SocialPostTextLayer = {
  enabled: boolean;
  text: string;
  /** Multiplier on the format default font size (0.6–2.5). */
  scale: number;
  /** Max line width as fraction of middle band (0.5–1 = 50%–100%). */
  box_width_scale: number;
  box_height_scale: number;
  align: SocialPostTextAlign;
  /** Headline + subcopy block corner (title only; subcopy follows). */
  block_placement?: SocialPostCorner;
  /** Extra space below logo / top of middle band (0–1, title only). */
  zone_inset_top?: number;
  /** Extra space above agent / bottom of middle band (0–1, title only). */
  zone_inset_bottom?: number;
  /** Vertical gap between headline, subcopy, and property details (0–3, default 1). */
  line_gap_scale?: number;
};

export type SocialPostLogoColour = "original" | "white" | "black" | "primary";

export type SocialPostLogoLayer = {
  enabled: boolean;
  placement: SocialPostCorner;
  /** Multiplier on the format default logo height (0.5–2). */
  scale: number;
  /** Recolour uploaded logo for contrast on photo backgrounds. */
  colour?: SocialPostLogoColour;
};

export type SocialPostAgentLayout = "vertical" | "horizontal";
export type SocialPostAvatarShape = "circle" | "square";
export type SocialPostAgentBackgroundStyle =
  | "none"
  | "glass"
  | "brand"
  | "custom";
export type SocialPostAgentBrandColour = "primary" | "secondary" | "accent";

export type SocialPostAgentLayer = {
  enabled: boolean;
  /** Bottom left, center, or right. Vertical layout: also sets column alignment. */
  placement: SocialPostCopyPlacement;
  scale: number;
  layout: SocialPostAgentLayout;
  avatar_shape: SocialPostAvatarShape;
  /** none = no box; glass = frosted dark; brand = agency colour; custom = pick colours */
  background_style: SocialPostAgentBackgroundStyle;
  /** Used when background_style is custom */
  background_colour: string;
  text_colour: string;
  /** Used when background_style is brand */
  brand_colour: SocialPostAgentBrandColour;
  /** Space between avatar and name/phone/email (0–2, default 1). */
  inner_gap_scale?: number;
  /** @deprecated Use placement (bottom_left/center/right). Migrated on load. */
  vertical_align?: SocialPostTextAlign;
};

export type SocialPostLayers = {
  logo: SocialPostLogoLayer;
  title: SocialPostTextLayer;
  subcopy: SocialPostTextLayer;
  features: SocialPostFeaturesLayer;
  agent: SocialPostAgentLayer;
};

export type SocialPostBackgroundLayout =
  | "single"
  | "split_vertical"
  | "split_horizontal"
  | "grid_2x2"
  | "row_3"
  | "col_3";

export type SocialPostVariantState = {
  /** Primary / first cell URL (legacy + export compat). */
  background_image_url: string;
  /** Collage layout for listing photos. */
  background_layout?: SocialPostBackgroundLayout;
  /** One URL per grid cell (length depends on layout). */
  background_image_urls?: string[];
  /** Per-format layer layout; omitted on legacy docs until migrated on load. */
  layers?: SocialPostLayers;
  /** True once the user edits layout for this format. */
  layout_customized?: boolean;
};

export type SocialPostsDocumentJson = {
  version: "social_posts_v1";
  type: "social_posts";
  template_id: string;
  generated_at: string;
  agency: CollateralBrandSlice;
  listing: CollateralListingSlice;
  agent: CollateralAgentSlice;
  active_variant_id: SocialPostVariantId;
  variants: Record<SocialPostVariantId, SocialPostVariantState>;
  /** Active format layers (mirror of variants[active_variant_id].layers). */
  layers: SocialPostLayers;
  exports?: Partial<
    Record<
      SocialPostVariantId,
      { png_url: string; exported_at: string }
    >
  >;
};

export type BrochureBlurbBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string };

export type BrochureCopyJson = {
  heading: string;
  /** Plain-text fallback; kept in sync with `blurb_blocks` for AI and legacy readers. */
  blurb: string;
  /** Structured description — preferred for editing and layout. */
  blurb_blocks: BrochureBlurbBlock[];
  /** Up to 8 short bullets — layout may show fewer depending on template. */
  property_highlights: string[];
  inspection_cta: string;
  disclaimer: string;
  /** Optional extra paragraph shown at the foot of the page-two gallery. */
  page_two_note?: string;
  /** Label shown above the price across every brochure layout. */
  price_label?: string;
  /**
   * Brochure-only override for the displayed price. When blank, the brochure
   * falls back to the listing's scraped price (`property.display_price`).
   */
  price_value?: string;
  /** Label shown above the bond on lease brochures (e.g. "Bond"). */
  bond_label?: string;
  /** Bond amount shown on lease brochures only. */
  bond_value?: string;
};

/** @deprecated Use BrochureCopyJson */
export type SalesBrochureCopyJson = BrochureCopyJson;

export type BrochurePropertySlice = {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  summary: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  car_spaces: number;
  land_area_sqm: number | null;
  display_price: string;
  hero_image_url: string;
  selected_image_urls: string[];
  page_one_image_urls: string[];
  page_two_image_urls: string[];
};

/** @deprecated Use BrochurePropertySlice */
export type SalesBrochurePropertySlice = BrochurePropertySlice;

type BrochureDocumentBase = {
  template_id: string;
  generated_at: string;
  /** Last time copy/images were saved in the editor. */
  content_saved_at?: string;
  /** Last time pdf_url reflected content_saved_at (set when PDF is generated). */
  pdf_synced_at?: string;
  agency: CollateralBrandSlice;
  agent: CollateralAgentSlice;
  agents: CollateralAgentSlice[];
  property: BrochurePropertySlice;
  /** Snapshot from listing at build time; used for floor plan fit in print/preview. */
  listing_image_meta?: ListingImageMetaMap;
  copy: BrochureCopyJson;
  qr_target_url: string;
  assets: {
    qr_code_url: string;
  };
};

export type SalesBrochureDocumentJson = BrochureDocumentBase & {
  version: "sales_brochure_v1";
  type: "sales_brochure";
};

export type RentalBrochureDocumentJson = BrochureDocumentBase & {
  version: "rental_brochure_v1";
  type: "rental_brochure";
};

export type BrochureDocumentJson =
  | SalesBrochureDocumentJson
  | RentalBrochureDocumentJson;

export type CollateralDocumentJson =
  | BusinessCardDocumentJson
  | SocialPostsDocumentJson
  | BrochureDocumentJson;

export function isSalesBrochureDocument(
  document: CollateralDocumentJson,
): document is SalesBrochureDocumentJson {
  return document.type === "sales_brochure";
}

export function isRentalBrochureDocument(
  document: CollateralDocumentJson,
): document is RentalBrochureDocumentJson {
  return document.type === "rental_brochure";
}

export function isBrochureDocument(
  document: CollateralDocumentJson,
): document is BrochureDocumentJson {
  return document.type === "sales_brochure" || document.type === "rental_brochure";
}

/** Default wording shown above the price when the user hasn't customised it. */
export const DEFAULT_BROCHURE_PRICE_LABEL = "Price";
export const DEFAULT_RENTAL_BROCHURE_PRICE_LABEL = "For lease";
export const DEFAULT_RENTAL_BROCHURE_BOND_LABEL = "Bond";

export function defaultBrochurePriceLabel(
  document: BrochureDocumentJson,
): string {
  return document.type === "rental_brochure"
    ? DEFAULT_RENTAL_BROCHURE_PRICE_LABEL
    : DEFAULT_BROCHURE_PRICE_LABEL;
}

/** Resolves the price label for a brochure, falling back to the default. */
export function resolveBrochurePriceLabel(document: BrochureDocumentJson): string {
  return document.copy.price_label?.trim() || defaultBrochurePriceLabel(document);
}

/**
 * Resolves the price shown on a brochure: a user override when set, otherwise
 * the listing's scraped price.
 */
export function resolveBrochurePrice(document: BrochureDocumentJson): string {
  return document.copy.price_value?.trim() || document.property.display_price;
}

export function defaultBrochureBondLabel(_document: BrochureDocumentJson): string {
  return DEFAULT_RENTAL_BROCHURE_BOND_LABEL;
}

export function resolveBrochureBondLabel(document: BrochureDocumentJson): string {
  return document.copy.bond_label?.trim() || defaultBrochureBondLabel(document);
}

/** Bond amount on lease brochures. No listing fallback — user-entered only. */
export function resolveBrochureBond(document: BrochureDocumentJson): string {
  if (document.type !== "rental_brochure") {
    return "";
  }
  return document.copy.bond_value?.trim() ?? "";
}

export function isSocialPostsDocument(
  document: CollateralDocumentJson,
): document is SocialPostsDocumentJson {
  return document.type === "social_posts";
}

export function isBusinessCardDocument(
  document: CollateralDocumentJson,
): document is BusinessCardDocumentJson {
  return document.type === "agent_business_card";
}

export type CollateralTemplateProps = {
  document: CollateralDocumentJson;
  pageFormat?: CollateralPageFormatId;
  variantId?: string;
};

export type CollateralTemplateDefinition = {
  id: string;
  collateralType: CollateralType;
  label: string;
  description: string;
  pageFormat: CollateralPageFormatId;
  pages: number;
  Component: ComponentType<CollateralTemplateProps>;
};

export type CollateralTemplateDefaults = Partial<Record<CollateralType, string>>;
