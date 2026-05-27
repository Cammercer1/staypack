import { z } from "zod";
import { isValidReportTemplateId } from "@/lib/reports/templates/ids";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";

function normalizeOptionalUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

const optionalWebsiteUrl = z
  .string()
  .transform((value) => normalizeOptionalUrl(value) as string)
  .refine(
    (value) => value === "" || z.string().url().safeParse(value).success,
    { message: "Enter a valid website URL" },
  );

const optionalEmail = z
  .string()
  .transform((value) => value.trim())
  .refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    { message: "Enter a valid email address" },
  );

export const agencyRoleSchema = z.enum(["owner", "admin", "member"]);

export const reportStatusSchema = z.enum([
  "draft",
  "scraped",
  "estimated",
  "generated",
  "published",
  "failed",
  "archived",
]);

export const agencySchema = z.object({
  name: z.string().min(2, "Agency name is required"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  website_url: optionalWebsiteUrl,
  email: optionalEmail,
  phone: z.string().optional(),
  logo_url: z.string().optional(),
  primary_colour: z.string(),
  secondary_colour: z.string(),
  accent_colour: z.string(),
  text_colour: z.string(),
  background_colour: z.string(),
  heading_font_family: z.string(),
  body_font_family: z.string(),
  font_family: z.string().optional(),
  heading_font_file_url: z.string().optional(),
  body_font_file_url: z.string().optional(),
  font_file_url: z.string().optional(),
  default_report_title: z.string(),
  default_cta: z.string(),
  default_disclaimer: z.string().optional(),
  report_template_id: z
    .string()
    .refine(isValidReportTemplateId, { message: "Select a valid report template" }),
});

export const agentProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: optionalEmail,
  phone: z.string().optional(),
  role_title: z.string().optional(),
  photo_url: z.string().optional(),
  is_default: z.boolean(),
});

export const createReportSchema = z.object({
  listing_url: z.string().url().optional(),
  property_address: z.string().optional(),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  car_spaces: z.coerce.number().optional(),
});

export const updateReportSchema = z.object({
  agent_profile_id: z.string().uuid().nullable().optional(),
  status: reportStatusSchema.optional(),
  listing_url: z.string().url().nullable().optional(),
  property_address: z.string().nullable().optional(),
  suburb: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  property_type: z.string().nullable().optional(),
  bedrooms: z.coerce.number().nullable().optional(),
  bathrooms: z.coerce.number().nullable().optional(),
  car_spaces: z.coerce.number().nullable().optional(),
  accommodates: z.coerce.number().nullable().optional(),
  listing_title: z.string().nullable().optional(),
  listing_description: z.string().nullable().optional(),
  display_price: z
    .string()
    .nullable()
    .optional()
    .transform((value) => {
      if (value == null) {
        return value;
      }
      const normalized = normalizeDisplayPrice(value);
      if (normalized) {
        return normalized;
      }
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }),
  hero_image_url: z.string().nullable().optional(),
  selected_image_urls: z.array(z.string()).max(5).optional(),
  uploaded_image_urls: z.array(z.string()).max(20).optional(),
  user_overrides_json: z.record(z.string(), z.unknown()).optional(),
  final_estimate_json: z.record(z.string(), z.unknown()).optional(),
  ai_copy_json: z.record(z.string(), z.unknown()).optional(),
  final_report_json: z.record(z.string(), z.unknown()).optional(),
  template_id: z
    .string()
    .nullable()
    .optional()
    .refine(
      (value) => value == null || isValidReportTemplateId(value),
      { message: "Select a valid report template" },
    ),
});

export const parsedListingSchema = z.object({
  title: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  suburb: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  propertyType: z.string().nullable().optional(),
  bedrooms: z.coerce.number().nullable().optional(),
  bathrooms: z.coerce.number().nullable().optional(),
  carSpaces: z.coerce.number().nullable().optional(),
  description: z.string().nullable().optional(),
  displayPrice: z.string().nullable().optional(),
  images: z.array(z.string()).default([]),
  agents: z
    .array(
      z.object({
        name: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
      }),
    )
    .default([]),
  confidence: z.enum(["low", "medium", "high"]).default("low"),
  warnings: z.array(z.string()).default([]),
});

export const scrapeListingSchema = z.object({
  report_id: z.string().uuid(),
  listing_url: z.string().url(),
});

export const airbticsEstimateSchema = z.object({
  report_id: z.string().uuid(),
  address: z.string().optional(),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  accommodates: z.coerce.number().optional(),
});

export const aiCopySchema = z.object({
  sales_pack_heading: z.string(),
  sales_pack_blurb: z.string(),
  key_metrics_line: z.string(),
  property_appeal_points: z.array(z.string()),
  performance_supporting_factors: z.array(z.string()),
  buyer_checks: z.array(z.string()),
  methodology_note: z.string(),
  disclaimer: z.string(),
  confidence_notes: z.string(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = loginSchema.extend({
  confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type ParsedListingInput = z.infer<typeof parsedListingSchema>;

export type AgencyInput = z.infer<typeof agencySchema>;
export type AgentProfileInput = z.infer<typeof agentProfileSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
