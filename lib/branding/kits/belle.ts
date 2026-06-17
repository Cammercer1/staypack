import type { CollateralBrandSlice } from "@/lib/collateral/templates/types";
import type { FinalReportJson } from "@/lib/types";

export const BELLE_TYPEKIT_STYLESHEET_URL = "https://use.typekit.net/zqo4azf.css";

export const BELLE_BRAND = {
  name: "belle PROPERTY",
  heroSubheadline: "Short-term rental potential · Market-backed estimate",
  leaseAppraisalHeading: "What can you lease this for?",
  leaseAppraisalSubheadline:
    "Long-term rental appraisal · Market-backed weekly rent range",
  logoOnDarkUrl:
    "https://propvue.azureedge.net/belle/public/img/belle-logo.svg",
  logoOnLightUrl:
    "https://propvue.azureedge.net/belle/public/img/belle-logo.svg",
  primary: "#386351",
  statBar: "#386351",
  pageBackground: "#ffffff",
  text: "#000000",
  accent: "#ffffff",
  headingFontId: "quiche-sans",
  bodyFontId: "lato",
  websiteUrl: "",
  contactEmail: "",
  contactPhone: "",
} as const;

function isBelleLeaseAppraisalTemplate(report: FinalReportJson) {
  return report.template_id === "belle-property-lease-appraisal";
}

function belleAgencySlice(
  agency: FinalReportJson["agency"],
): FinalReportJson["agency"] {
  return {
    ...agency,
    name: BELLE_BRAND.name,
    logo_url: BELLE_BRAND.logoOnDarkUrl,
    logo_light_url: BELLE_BRAND.logoOnDarkUrl,
    logo_dark_url: BELLE_BRAND.logoOnLightUrl,
    primary_colour: BELLE_BRAND.primary,
    secondary_colour: BELLE_BRAND.pageBackground,
    accent_colour: BELLE_BRAND.accent,
    text_colour: BELLE_BRAND.text,
    callout_heading_colour: BELLE_BRAND.accent,
    callout_text_colour: BELLE_BRAND.accent,
    background_colour: BELLE_BRAND.pageBackground,
    heading_font_family: BELLE_BRAND.headingFontId,
    body_font_family: BELLE_BRAND.bodyFontId,
    font_family: BELLE_BRAND.bodyFontId,
    heading_font_file_url: "",
    body_font_file_url: "",
    font_file_url: "",
    website_url: BELLE_BRAND.websiteUrl,
    email: BELLE_BRAND.contactEmail,
    phone: BELLE_BRAND.contactPhone,
  };
}

export function applyBelleBrandKitToAgencySlice(
  agency: CollateralBrandSlice,
): CollateralBrandSlice {
  return {
    ...agency,
    name: BELLE_BRAND.name,
    logo_url: BELLE_BRAND.logoOnDarkUrl,
    logo_light_url: BELLE_BRAND.logoOnDarkUrl,
    logo_dark_url: BELLE_BRAND.logoOnLightUrl,
    primary_colour: BELLE_BRAND.primary,
    secondary_colour: BELLE_BRAND.pageBackground,
    accent_colour: BELLE_BRAND.accent,
    text_colour: BELLE_BRAND.text,
    callout_heading_colour: BELLE_BRAND.accent,
    callout_text_colour: BELLE_BRAND.accent,
    background_colour: BELLE_BRAND.pageBackground,
    heading_font_family: BELLE_BRAND.headingFontId,
    body_font_family: BELLE_BRAND.bodyFontId,
    font_family: BELLE_BRAND.bodyFontId,
    heading_font_file_url: "",
    body_font_file_url: "",
    font_file_url: "",
    website_url: BELLE_BRAND.websiteUrl,
    email: BELLE_BRAND.contactEmail,
    phone: BELLE_BRAND.contactPhone,
  };
}

/** Fixed visual brand only — preserves listing/API-resolved agents. */
export function applyBelleBrandKitToReport(
  report: FinalReportJson,
): FinalReportJson {
  const leaseAppraisal = isBelleLeaseAppraisalTemplate(report);

  return {
    ...report,
    assets: {
      ...report.assets,
      qr_code_url: "",
    },
    copy: {
      ...report.copy,
      heading: leaseAppraisal
        ? report.copy.heading &&
          !/long-term rental appraisal/i.test(report.copy.heading)
          ? report.copy.heading
          : BELLE_BRAND.leaseAppraisalHeading
        : report.copy.heading || BELLE_BRAND.heroSubheadline,
    },
    agency: belleAgencySlice(report.agency),
  };
}
