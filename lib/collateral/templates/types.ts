import type { ComponentType } from "react";
import type { SocialPostVariantId } from "@/lib/collateral/social/formats";
import type { AgencyBrandAdvanced, CollateralType } from "@/lib/types";

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
  listing: CollateralListingSlice;
  agent: CollateralAgentSlice;
  qr_target_url: string;
  assets: {
    qr_code_url: string;
  };
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

export type SalesBrochureCopyJson = {
  heading: string;
  blurb: string;
  appeal_points: string[];
  feature_highlights: string[];
  inspection_cta: string;
  disclaimer: string;
};

export type SalesBrochurePropertySlice = {
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

export type SalesBrochureDocumentJson = {
  version: "sales_brochure_v1";
  type: "sales_brochure";
  template_id: string;
  generated_at: string;
  agency: CollateralBrandSlice;
  agent: CollateralAgentSlice;
  agents: CollateralAgentSlice[];
  property: SalesBrochurePropertySlice;
  copy: SalesBrochureCopyJson;
  qr_target_url: string;
  assets: {
    qr_code_url: string;
  };
};

export type CollateralDocumentJson =
  | BusinessCardDocumentJson
  | SocialPostsDocumentJson
  | SalesBrochureDocumentJson;

export function isSalesBrochureDocument(
  document: CollateralDocumentJson,
): document is SalesBrochureDocumentJson {
  return document.type === "sales_brochure";
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
  variantId?: SocialPostVariantId;
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
