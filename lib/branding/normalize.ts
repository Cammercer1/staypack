import { parseAgencyBrandAdvanced } from "@/lib/branding/advanced";
import { DEFAULT_REPORT_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import type { AgencyInput } from "@/lib/validation/schemas";
import type { Agency } from "@/lib/types";

export function normalizeAgencyBrandPayload(body: AgencyInput) {
  const headingFontFamily = body.heading_font_family || body.font_family || "fraunces";
  const bodyFontFamily = body.body_font_family || body.font_family || "inter";
  const { brand_advanced_json, ...rest } = body;

  return {
    ...rest,
    website_url: body.website_url || null,
    email: body.email || null,
    phone: body.phone || null,
    logo_light_url: body.logo_light_url?.trim() || null,
    logo_dark_url: body.logo_dark_url?.trim() || null,
    logo_url:
      body.logo_dark_url?.trim() ||
      body.logo_url?.trim() ||
      body.logo_light_url?.trim() ||
      null,
    heading_font_family: headingFontFamily,
    body_font_family: bodyFontFamily,
    font_family: bodyFontFamily,
    heading_font_file_url: body.heading_font_file_url || body.font_file_url || null,
    body_font_file_url: body.body_font_file_url || body.font_file_url || null,
    font_file_url: body.body_font_file_url || body.font_file_url || null,
    default_disclaimer: body.default_disclaimer || null,
    report_template_id: body.report_template_id || DEFAULT_REPORT_TEMPLATE_ID,
    secondary_colour: body.background_colour,
    ...(brand_advanced_json !== undefined
      ? { brand_advanced_json: parseAgencyBrandAdvanced(brand_advanced_json) }
      : {}),
  };
}

export const DEFAULT_BRAND_VALUES: Partial<AgencyInput> = {
  primary_colour: "#2563eb",
  secondary_colour: "#ffffff",
  accent_colour: "#f7f7f7",
  text_colour: "#333333",
  background_colour: "#ffffff",
  heading_font_family: "fraunces",
  body_font_family: "inter",
  font_family: "inter",
  heading_font_file_url: "",
  body_font_file_url: "",
  font_file_url: "",
  report_template_id: DEFAULT_REPORT_TEMPLATE_ID,
};

export function agencyToFormInput(agency: Agency): AgencyInput {
  return {
    name: agency.name,
    slug: agency.slug,
    website_url: agency.website_url ?? "",
    email: agency.email ?? "",
    phone: agency.phone ?? "",
    logo_url: agency.logo_url ?? "",
    logo_light_url: agency.logo_light_url ?? "",
    logo_dark_url: agency.logo_dark_url ?? agency.logo_url ?? "",
    primary_colour: agency.primary_colour,
    secondary_colour: agency.secondary_colour,
    accent_colour: agency.accent_colour,
    text_colour: agency.text_colour ?? agency.primary_colour,
    background_colour: agency.background_colour ?? agency.secondary_colour,
    heading_font_family: agency.heading_font_family ?? agency.font_family ?? "fraunces",
    body_font_family: agency.body_font_family ?? agency.font_family ?? "inter",
    font_family: agency.body_font_family ?? agency.font_family ?? "inter",
    heading_font_file_url: agency.heading_font_file_url ?? "",
    body_font_file_url: agency.body_font_file_url ?? agency.font_file_url ?? "",
    font_file_url: agency.body_font_file_url ?? agency.font_file_url ?? "",
    default_report_title: agency.default_report_title,
    default_cta: agency.default_cta,
    default_disclaimer: agency.default_disclaimer ?? "",
    report_template_id: agency.report_template_id ?? DEFAULT_REPORT_TEMPLATE_ID,
    brand_advanced_json: parseAgencyBrandAdvanced(agency.brand_advanced_json),
  };
}
