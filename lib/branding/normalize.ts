import type { AgencyInput } from "@/lib/validation/schemas";

export function normalizeAgencyBrandPayload(body: AgencyInput) {
  const headingFontFamily = body.heading_font_family || body.font_family || "fraunces";
  const bodyFontFamily = body.body_font_family || body.font_family || "inter";

  return {
    ...body,
    website_url: body.website_url || null,
    email: body.email || null,
    phone: body.phone || null,
    logo_url: body.logo_url || null,
    heading_font_family: headingFontFamily,
    body_font_family: bodyFontFamily,
    font_family: bodyFontFamily,
    heading_font_file_url: body.heading_font_file_url || body.font_file_url || null,
    body_font_file_url: body.body_font_file_url || body.font_file_url || null,
    font_file_url: body.body_font_file_url || body.font_file_url || null,
    default_disclaimer: body.default_disclaimer || null,
    report_template_id: body.report_template_id || "classic-light",
    secondary_colour: body.background_colour,
  };
}

export const DEFAULT_BRAND_VALUES: Partial<AgencyInput> = {
  primary_colour: "#002e36",
  secondary_colour: "#f9f5ea",
  accent_colour: "#e8efe3",
  text_colour: "#002e36",
  background_colour: "#f9f5ea",
  heading_font_family: "fraunces",
  body_font_family: "inter",
  font_family: "inter",
  heading_font_file_url: "",
  body_font_file_url: "",
  font_file_url: "",
  report_template_id: "classic-light",
};
