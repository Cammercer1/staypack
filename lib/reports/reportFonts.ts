import {
  buildBrandGoogleFontsUrl,
  resolveBodyFontFamily,
  resolveHeadingFontFamily,
} from "@/lib/branding/google-fonts";
import type { FinalReportJson } from "@/lib/types";

export type ReportFontConfig = {
  headingFontId: string;
  bodyFontId: string;
  headingFontFamily: string;
  bodyFontFamily: string;
  googleFontsUrl: string | null;
};

export function getReportFontConfig(
  agency: FinalReportJson["agency"],
): ReportFontConfig {
  const headingFontId = agency.heading_font_family || agency.font_family || "fraunces";
  const bodyFontId = agency.body_font_family || agency.font_family || "inter";
  const headingFontFileUrl = agency.heading_font_file_url || null;
  const bodyFontFileUrl = agency.body_font_file_url || agency.font_file_url || null;

  return {
    headingFontId,
    bodyFontId,
    headingFontFamily: resolveHeadingFontFamily(headingFontId, headingFontFileUrl),
    bodyFontFamily: resolveBodyFontFamily(bodyFontId, bodyFontFileUrl),
    googleFontsUrl: buildBrandGoogleFontsUrl(
      headingFontId,
      bodyFontId,
      headingFontFileUrl,
      bodyFontFileUrl,
    ),
  };
}
