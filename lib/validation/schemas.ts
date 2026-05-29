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
  logo_light_url: z.string().optional(),
  logo_dark_url: z.string().optional(),
  primary_colour: z.string(),
  secondary_colour: z.string(),
  accent_colour: z.string(),
  text_colour: z.string(),
  callout_heading_colour: z.string().optional(),
  callout_text_colour: z.string().optional(),
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
  brand_advanced_json: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const agentProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: optionalEmail,
  phone: z.string().optional(),
  role_title: z.string().optional(),
  photo_url: z.string().optional(),
  is_default: z.boolean(),
});

export const listingAgentSchema = z.object({
  name: z.string().trim(),
  email: optionalEmail.optional().nullable(),
  phone: z.string().optional().nullable(),
  role_title: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
});

export const parsedListingSchema = z.object({
  title: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  suburb: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  propertyType: z.string().nullable().optional(),
  purpose: z.enum(["sale", "lease"]).nullable().optional(),
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
        photo_url: z.string().nullable().optional(),
        role_title: z.string().nullable().optional(),
      }),
    )
    .default([]),
  confidence: z.enum(["low", "medium", "high"]).default("low"),
  warnings: z.array(z.string()).default([]),
});

export const listingStatusSchema = z.enum(["active", "archived"]);

const collateralImageSelectionSchema = z.object({
  hero_image_url: z.string().nullable().optional(),
  selected_image_urls: z.array(z.string()).max(25).optional(),
});

const collateralImageChannelSchema = z.enum([
  "landing",
  "str_report",
  "sales_brochure",
  "rental_brochure",
  "social_posts",
  "investor_snapshot",
  "agent_business_card",
]);

const listingPropertyFields = {
  agent_profile_id: z.string().uuid().nullable().optional(),
  listing_purpose: z.enum(["sale", "lease"]).optional(),
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
  selected_image_urls: z.array(z.string()).max(25).optional(),
  uploaded_image_urls: z.array(z.string()).max(20).optional(),
  custom_landing_url: z.string().url().nullable().optional(),
  landing_template: z.string().nullable().optional(),
  collateral_image_selections: z
    .record(collateralImageChannelSchema, collateralImageSelectionSchema)
    .optional(),
  listing_agents: z.array(listingAgentSchema).max(2).optional(),
  scraped_listing_json: parsedListingSchema.optional(),
};

export const updateListingSchema = z.object({
  status: listingStatusSchema.optional(),
  ...listingPropertyFields,
});

export const createListingSchema = updateListingSchema.extend({
  property_address: z.string().trim().min(1, "Property address is required"),
});

export const updateReportSchema = z.object({
  status: reportStatusSchema.optional(),
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

export const createReportSchema = z.object({
  listing_id: z.string().uuid().optional(),
});

export const scrapeListingSchema = z.object({
  report_id: z.string().uuid().optional(),
  listing_id: z.string().uuid().optional(),
  listing_url: z.string().url(),
});

export const airbticsEstimateSchema = z.object({
  report_id: z.string().uuid(),
  tier: z.enum(["summary", "full"]).default("summary"),
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

/** OpenAI structured output — every field required (no `.optional()`). */
export const brochureBlurbBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string() }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
]);

export const salesBrochureCopyAiSchema = z.object({
  heading: z.string(),
  blurb: z.string(),
  property_highlights: z.array(z.string()),
  inspection_cta: z.string(),
  disclaimer: z.string(),
});

export const salesBrochureCopySchema = salesBrochureCopyAiSchema.extend({
  blurb_blocks: z.array(brochureBlurbBlockSchema).optional(),
  page_two_note: z.string().optional(),
  price_label: z.string().optional(),
  price_value: z.string().optional(),
});

export const salesBrochurePropertyImagesSchema = z.object({
  hero_image_url: z.string().optional(),
  selected_image_urls: z.array(z.string()).optional(),
  page_one_image_urls: z.array(z.string()).optional(),
  page_two_image_urls: z.array(z.string()).optional(),
});

export const updateSalesBrochureDocumentSchema = z
  .object({
    copy: salesBrochureCopySchema.partial().optional(),
    property: salesBrochurePropertyImagesSchema.optional(),
    template_id: z.string().optional(),
  })
  .refine(
    (data) =>
      data.copy != null || data.template_id != null || data.property != null,
    { message: "Provide copy, property images, or template_id" },
  );

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

export const generateCopyRequestSchema = z.object({
  template_id: z
    .string()
    .optional()
    .refine(
      (value) => value == null || isValidReportTemplateId(value),
      { message: "Select a valid report template" },
    ),
});

export const leadStatusSchema = z.enum(["new", "contacted"]);

export const collateralTypeSchema = z.enum([
  "str_report",
  "sales_brochure",
  "rental_brochure",
  "social_posts",
  "investor_snapshot",
  "agent_business_card",
]);

export const createPublicLeadSchema = z.object({
  agency_slug: z.string().min(1),
  listing_slug: z.string().min(1),
  name: z.string().trim().min(1, "Name is required"),
  email: optionalEmail.optional().nullable(),
  phone: z.string().optional().nullable(),
});

export const updateLeadSchema = z.object({
  status: leadStatusSchema,
});

export const createCollateralSchema = z.object({
  type: collateralTypeSchema,
});

const socialPostVariantIdSchema = z.enum(["square", "wide", "story"]);

const socialPostCornerSchema = z.enum([
  "top_left",
  "top_right",
  "bottom_left",
  "bottom_right",
]);

const socialPostCopyPlacementSchema = z.enum([
  "bottom_left",
  "bottom_center",
  "bottom_right",
]);

const socialPostTextAlignSchema = z.enum(["left", "center", "right"]);

const socialPostTextLayerSchema = z.object({
  enabled: z.boolean(),
  text: z.string().max(500),
  scale: z.number().min(0.6).max(2.5).optional(),
  box_width_scale: z.number().min(0.5).max(1).optional(),
  zone_inset_top: z.number().min(0).max(1).optional(),
  zone_inset_bottom: z.number().min(0).max(1).optional(),
  line_gap_scale: z.number().min(0).max(3).optional(),
  box_height_scale: z.number().min(0.5).max(3).optional(),
  align: socialPostTextAlignSchema.optional(),
  block_placement: socialPostCornerSchema.optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
});

const socialPostLogoColourSchema = z.enum([
  "original",
  "white",
  "black",
  "primary",
]);

const socialPostLogoLayerSchema = z.object({
  enabled: z.boolean(),
  placement: socialPostCornerSchema.optional(),
  scale: z.number().min(0.5).max(2).optional(),
  colour: socialPostLogoColourSchema.optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
});

const socialPostAgentLayoutSchema = z.enum(["vertical", "horizontal"]);
const socialPostAvatarShapeSchema = z.enum(["circle", "square"]);

const socialPostAgentBackgroundStyleSchema = z.enum([
  "none",
  "glass",
  "brand",
  "custom",
]);

const socialPostAgentBrandColourSchema = z.enum([
  "primary",
  "secondary",
  "accent",
]);

const socialPostFeaturesLayerSchema = z.object({
  enabled: z.boolean(),
  show_bedrooms: z.boolean().optional(),
  show_bathrooms: z.boolean().optional(),
  show_car_spaces: z.boolean().optional(),
  show_land_area: z.boolean().optional(),
  scale: z.number().min(0.6).max(2.5).optional(),
});

const socialPostListingSliceSchema = z.object({
  bedrooms: z.coerce.number().nullable().optional(),
  bathrooms: z.coerce.number().nullable().optional(),
  car_spaces: z.coerce.number().nullable().optional(),
  land_area_sqm: z.coerce.number().nullable().optional(),
});

const socialPostAgentLayerSchema = z.object({
  enabled: z.boolean(),
  placement: socialPostCopyPlacementSchema.optional(),
  scale: z.number().min(0.1).max(2).optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  layout: socialPostAgentLayoutSchema.optional(),
  avatar_shape: socialPostAvatarShapeSchema.optional(),
  background_style: socialPostAgentBackgroundStyleSchema.optional(),
  background_colour: z.string().max(32).optional(),
  text_colour: z.string().max(32).optional(),
  brand_colour: socialPostAgentBrandColourSchema.optional(),
  inner_gap_scale: z.number().min(0).max(2).optional(),
  vertical_align: socialPostTextAlignSchema.optional(),
});

const socialPostLayersSchema = z.object({
  logo: socialPostLogoLayerSchema,
  title: socialPostTextLayerSchema,
  subcopy: socialPostTextLayerSchema,
  features: socialPostFeaturesLayerSchema,
  agent: socialPostAgentLayerSchema,
});

const socialPostBackgroundLayoutSchema = z.enum([
  "single",
  "split_vertical",
  "split_horizontal",
  "grid_2x2",
  "row_3",
  "col_3",
]);

const socialPostVariantStateSchema = z.object({
  background_image_url: z.string().min(0),
  background_layout: socialPostBackgroundLayoutSchema.optional(),
  background_image_urls: z.array(z.string().min(0)).max(4).optional(),
  layers: socialPostLayersSchema.optional(),
  layout_customized: z.boolean().optional(),
});

const socialPostAgentSliceSchema = z.object({
  name: z.string().max(200).optional(),
  role_title: z.string().max(200).optional(),
  phone: z.string().max(80).optional(),
  email: z.string().max(200).optional(),
  photo_url: z.string().max(2000).optional(),
});

export const updateSocialPostsDocumentSchema = z.object({
  active_variant_id: socialPostVariantIdSchema.optional(),
  agent: socialPostAgentSliceSchema.optional(),
  listing: socialPostListingSliceSchema.optional(),
  layers: z
    .object({
      logo: socialPostLogoLayerSchema.optional(),
      title: socialPostTextLayerSchema.optional(),
      subcopy: socialPostTextLayerSchema.optional(),
      features: socialPostFeaturesLayerSchema.optional(),
      agent: socialPostAgentLayerSchema.optional(),
    })
    .optional(),
  variants: z
    .record(socialPostVariantIdSchema, socialPostVariantStateSchema)
    .optional(),
});

const businessCardVariantIdSchema = z.enum(["front", "back"]);

const businessCardLayerStateSchema = z.object({
  enabled: z.boolean().optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  scale: z.number().min(0.25).max(3).optional(),
  width: z.number().min(8).max(100).optional(),
});

const businessCardVariantStateSchema = z.object({
  headline: z.string().max(160).optional(),
  subcopy: z.string().max(260).optional(),
  show_logo: z.boolean().optional(),
  show_agent_photo: z.boolean().optional(),
  show_contact: z.boolean().optional(),
  show_agency_details: z.boolean().optional(),
  show_qr: z.boolean().optional(),
  background_style: z.enum(["light", "brand"]).optional(),
  back_style: z.enum(["colour", "photo"]).optional(),
  back_colour: z.string().max(32).optional().nullable(),
  qr_corner: z.enum(["bottom_left", "bottom_right"]).optional(),
  back_logo_variant: z.enum(["light", "dark", "custom"]).optional(),
  back_logo_custom_url: z.string().max(2000).optional(),
  layers: z
    .object({
      logo: businessCardLayerStateSchema.optional(),
      headline: businessCardLayerStateSchema.optional(),
      subcopy: businessCardLayerStateSchema.optional(),
      agent_photo: businessCardLayerStateSchema.optional(),
      agent_contact: businessCardLayerStateSchema.optional(),
      qr: businessCardLayerStateSchema.optional(),
      agency_details: businessCardLayerStateSchema.optional(),
    })
    .optional(),
});

const businessCardAgentSliceSchema = z.object({
  name: z.string().max(200).optional(),
  role_title: z.string().max(200).optional(),
  phone: z.string().max(80).optional(),
  email: z.string().max(200).optional(),
  photo_url: z.string().max(2000).optional(),
});

export const updateBusinessCardDocumentSchema = z.object({
  active_variant_id: businessCardVariantIdSchema.optional(),
  agent_profile_id: z.string().uuid().nullable().optional(),
  agent: businessCardAgentSliceSchema.optional(),
  qr_listing_id: z.string().uuid().nullable().optional(),
  variants: z
    .record(businessCardVariantIdSchema, businessCardVariantStateSchema)
    .optional(),
});

export const createBusinessCardSchema = z.object({
  agent_profile_id: z.string().uuid().nullable().optional(),
});

export const exportSocialPostPngSchema = z.object({
  variant: socialPostVariantIdSchema,
  /** PNG bytes from client-side canvas capture (base64). */
  png_base64: z.string().min(1),
});

export type ParsedListingInput = z.infer<typeof parsedListingSchema>;

export type AgencyInput = z.infer<typeof agencySchema>;
export type GenerateCopyRequestInput = z.infer<typeof generateCopyRequestSchema>;
export type AgentProfileInput = z.infer<typeof agentProfileSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type CreatePublicLeadInput = z.infer<typeof createPublicLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateCollateralInput = z.infer<typeof createCollateralSchema>;
