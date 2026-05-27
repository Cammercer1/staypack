import type { Agency, FinalReportJson } from "@/lib/types";

export function mergeAgencyBrandIntoFinalReport(
  agency: Agency,
  report: FinalReportJson,
): FinalReportJson {
  return {
    ...report,
    agency: {
      ...report.agency,
      name: agency.name,
      logo_url: agency.logo_url ?? "",
      primary_colour: agency.primary_colour,
      secondary_colour: agency.background_colour ?? agency.secondary_colour,
      accent_colour: agency.accent_colour,
      text_colour: agency.text_colour ?? agency.primary_colour,
      background_colour: agency.background_colour ?? agency.secondary_colour,
      heading_font_family: agency.heading_font_family ?? agency.font_family,
      body_font_family: agency.body_font_family ?? agency.font_family,
      font_family: agency.body_font_family ?? agency.font_family,
      heading_font_file_url: agency.heading_font_file_url ?? "",
      body_font_file_url: agency.body_font_file_url ?? agency.font_file_url ?? "",
      font_file_url: agency.body_font_file_url ?? agency.font_file_url ?? "",
      website_url: agency.website_url ?? "",
      phone: agency.phone ?? "",
      email: agency.email ?? "",
    },
  };
}
