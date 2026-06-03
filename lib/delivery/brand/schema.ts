import { z } from "zod";
import { isValidReportTemplateId } from "@/lib/reports/templates/ids";

/**
 * Brand kit for a managed-delivery tenant (no StayPacks app account required).
 * Mirrors agency brand fields used in STR reports.
 */
export const deliveryTenantBrandSchema = z.object({
  displayName: z.string().min(1).optional(),
  website_url: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  logo_url: z.string().optional(),
  logo_light_url: z.string().optional(),
  logo_dark_url: z.string().optional(),
  primary_colour: z.string().optional(),
  secondary_colour: z.string().optional(),
  accent_colour: z.string().optional(),
  text_colour: z.string().optional(),
  callout_heading_colour: z.string().optional(),
  callout_text_colour: z.string().optional(),
  background_colour: z.string().optional(),
  heading_font_family: z.string().optional(),
  body_font_family: z.string().optional(),
  heading_font_file_url: z.string().optional(),
  body_font_file_url: z.string().optional(),
  font_file_url: z.string().optional(),
  font_family: z.string().optional(),
  default_report_title: z.string().optional(),
  default_cta: z.string().optional(),
  default_disclaimer: z.string().optional(),
  report_template_id: z
    .string()
    .refine((id) => !id || isValidReportTemplateId(id), {
      message: "Invalid report template id",
    })
    .optional(),
  brand_advanced_json: z.record(z.string(), z.unknown()).optional().nullable(),
  /** Default agent block on automated STR reports */
  agent: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      role_title: z.string().optional(),
      photo_url: z.string().optional(),
    })
    .optional(),
});

export type DeliveryTenantBrand = z.infer<typeof deliveryTenantBrandSchema>;

export const DEFAULT_DELIVERY_BRAND: Required<
  Pick<
    DeliveryTenantBrand,
    | "primary_colour"
    | "secondary_colour"
    | "accent_colour"
    | "text_colour"
    | "background_colour"
    | "heading_font_family"
    | "body_font_family"
  >
> = {
  primary_colour: "#111111",
  secondary_colour: "#FFFFFF",
  accent_colour: "#F4F4F5",
  text_colour: "#002e36",
  background_colour: "#f9f5ea",
  heading_font_family: "fraunces",
  body_font_family: "inter",
};
