import {
  getBrandAdvancedCssVars,
  resolveBrandAdvanced,
} from "@/lib/branding/advanced";
import { getBrandLogoCssVars } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";

export type ReportBrandColours = {
  headline: string;
  text: string;
  softHighlight: string;
  calloutHeading: string;
  calloutText: string;
  pageBackground: string;
};

export function getReportBrandColours(
  agency: FinalReportJson["agency"],
): ReportBrandColours {
  return {
    headline: agency.primary_colour,
    text: agency.text_colour || "#1a1a1a",
    softHighlight: agency.accent_colour || "#f3f4f6",
    calloutHeading: agency.callout_heading_colour || agency.text_colour || "#1a1a1a",
    calloutText: agency.callout_text_colour || agency.text_colour || "#1a1a1a",
    pageBackground: agency.background_colour || agency.secondary_colour || "#ffffff",
  };
}

export function getReportBrandColourVars(colours: ReportBrandColours) {
  return {
    ["--report-headline-colour" as string]: colours.headline,
    ["--report-text-colour" as string]: colours.text,
    ["--report-soft-highlight" as string]: colours.softHighlight,
    ["--report-callout-heading" as string]: colours.calloutHeading,
    ["--report-callout-text" as string]: colours.calloutText,
    ["--report-page-background" as string]: colours.pageBackground,
  };
}

export function getReportBrandAdvancedVars(agency: FinalReportJson["agency"]) {
  const resolved = resolveBrandAdvanced({
    primary_colour: agency.primary_colour,
    text_colour: agency.text_colour,
    brand_advanced_json: agency.brand_advanced ?? null,
  });

  return getBrandAdvancedCssVars(resolved);
}

export function getReportBrandLogoVars(agency: FinalReportJson["agency"]) {
  return getBrandLogoCssVars(agency);
}

/** Colour, advanced, and logo CSS variables for report/collateral previews. */
export function getReportBrandStyleVars(
  agency: FinalReportJson["agency"],
  colours?: ReportBrandColours,
) {
  const brandColours = colours ?? getReportBrandColours(agency);

  return {
    ...getReportBrandColourVars(brandColours),
    ...getReportBrandAdvancedVars(agency),
    ...getReportBrandLogoVars(agency),
  };
}
