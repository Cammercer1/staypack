import type { FinalReportJson } from "@/lib/types";

export type ReportBrandColours = {
  headline: string;
  text: string;
  softHighlight: string;
  pageBackground: string;
};

export function getReportBrandColours(
  agency: FinalReportJson["agency"],
): ReportBrandColours {
  return {
    headline: agency.primary_colour,
    text: agency.text_colour || "#1a1a1a",
    softHighlight: agency.accent_colour || "#f3f4f6",
    pageBackground: agency.background_colour || agency.secondary_colour || "#ffffff",
  };
}

export function getReportBrandColourVars(colours: ReportBrandColours) {
  return {
    ["--report-headline-colour" as string]: colours.headline,
    ["--report-text-colour" as string]: colours.text,
    ["--report-soft-highlight" as string]: colours.softHighlight,
    ["--report-page-background" as string]: colours.pageBackground,
  };
}
