import { buildAgencyBrandSlice } from "@/lib/collateral/buildAgencyBrandSlice";
import { DEFAULT_BRAND_VALUES } from "@/lib/branding/normalize";
import type {
  CollateralAgentSlice,
  CollateralBrandSlice,
  SalesBrochureDocumentJson,
  SocialPostAgentLayer,
} from "@/lib/collateral/templates/types";
import type { Agency } from "@/lib/types";

/** Default agent block styling for brochure previews (matches social “brand” profile box). */
export const SALES_BROCHURE_PREVIEW_AGENT_LAYER: Pick<
  SocialPostAgentLayer,
  | "enabled"
  | "placement"
  | "scale"
  | "layout"
  | "avatar_shape"
  | "background_style"
  | "background_colour"
  | "text_colour"
  | "brand_colour"
  | "inner_gap_scale"
> = {
  enabled: true,
  placement: "bottom_left",
  scale: 1,
  layout: "horizontal",
  avatar_shape: "circle",
  background_style: "brand",
  background_colour: DEFAULT_BRAND_VALUES.primary_colour ?? "#002e36",
  text_colour: "#ffffff",
  brand_colour: "primary",
  inner_gap_scale: 1,
};

const FALLBACK_AGENCY_SLICE: CollateralBrandSlice = {
  name: "Your agency",
  logo_url: "",
  logo_light_url: "",
  logo_dark_url: "",
  primary_colour: DEFAULT_BRAND_VALUES.primary_colour ?? "#002e36",
  secondary_colour: DEFAULT_BRAND_VALUES.secondary_colour ?? "#f9f5ea",
  accent_colour: DEFAULT_BRAND_VALUES.accent_colour ?? "#e8efe3",
  text_colour: DEFAULT_BRAND_VALUES.text_colour ?? "#002e36",
  background_colour: DEFAULT_BRAND_VALUES.background_colour ?? "#f9f5ea",
  heading_font_family: DEFAULT_BRAND_VALUES.heading_font_family ?? "fraunces",
  body_font_family: DEFAULT_BRAND_VALUES.body_font_family ?? "inter",
  font_family: DEFAULT_BRAND_VALUES.font_family ?? "inter",
  heading_font_file_url: "",
  body_font_file_url: "",
  font_file_url: "",
  website_url: "https://staypack.app",
  email: "hello@staypack.app",
  phone: "",
  brand_advanced: null,
};

const FALLBACK_AGENT_SLICE: CollateralAgentSlice = {
  name: "Harvey Specter",
  role_title: "Senior Sales Agent",
  phone: "",
  email: "",
  photo_url: "",
};

export type SalesBrochurePreviewBrand = {
  agency: CollateralBrandSlice;
  agent: CollateralAgentSlice;
};

export function getSalesBrochurePreviewBrandFixture(): SalesBrochurePreviewBrand {
  return {
    agency: FALLBACK_AGENCY_SLICE,
    agent: FALLBACK_AGENT_SLICE,
  };
}

export function salesBrochurePreviewBrandFromAgency(
  agency: Agency,
  agent: CollateralAgentSlice,
): SalesBrochurePreviewBrand {
  return {
    agency: buildAgencyBrandSlice(agency),
    agent,
  };
}

/** Overlay showcase agency + agent on in-app brochure previews (not publish/PDF). */
export function applySalesBrochurePreviewBrand(
  document: SalesBrochureDocumentJson,
  preview: SalesBrochurePreviewBrand,
): SalesBrochureDocumentJson {
  return {
    ...document,
    agency: preview.agency,
    agent: preview.agent,
    agents: [preview.agent],
  };
}
