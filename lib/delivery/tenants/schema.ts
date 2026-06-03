import { z } from "zod";
import { deliveryTenantBrandSchema } from "@/lib/delivery/brand/schema";
import { rentAppraisalConfigSchema } from "@/lib/delivery/rentAppraisalConfig";

export const scrapeScheduleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("interval"),
    intervalHours: z.number().positive().max(168),
  }),
  z.object({
    type: z.literal("cron"),
    cron: z.string().min(9).max(100),
  }),
]);

export const partnerSourceSchema = z.object({
  label: z.string().optional(),
  url: z.string().url(),
  adapter: z.string().optional(),
  /** Adapter options: `max_listings` per site per run; `maxPages` for spfn_first_national_v1. */
  config: z.record(z.string(), z.unknown()).optional(),
});

export const deliveryTenantSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  agency_id: z.string().uuid().optional().nullable(),
  brand: deliveryTenantBrandSchema.optional().default({}),
  enabled: z.boolean().optional().default(true),
  timezone: z.string().min(1).default("Australia/Sydney"),
  scrape_enabled: z.boolean().optional().default(true),
  scrape_schedule: scrapeScheduleSchema.default({
    type: "interval",
    intervalHours: 24,
  }),
  partner_sources: z.array(partnerSourceSchema).min(1),
  email_recipients: z.array(z.string().email()).min(1),
  email_from: z.string().email().optional(),
  email_subject_template: z.string().optional(),
  str_template_pack_id: z.string().optional(),
  deliverables: z
    .array(z.enum(["str", "lease_appraisal"]))
    .optional()
    .default(["str"]),
  billing_mode: z
    .enum(["production", "shadow", "dry_run"])
    .optional()
    .default("dry_run"),
  billing: z
    .object({
      billingPlan: z.string().optional(),
      includedDeliveriesPerMonth: z.number().int().nonnegative().optional(),
      overagePricePerDeliveryCents: z.number().int().nonnegative().optional(),
      billingEmail: z.string().email().optional(),
      stripeCustomerId: z.string().optional(),
    })
    .optional()
    .default({}),
  feature_flags: z
    .object({
      rent_appraisal: rentAppraisalConfigSchema.optional(),
      max_listings_per_run: z.number().int().positive().max(25).optional(),
    })
    .catchall(z.unknown())
    .optional()
    .default({}),
  reprocess_on_material_change: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  const hasAgency = Boolean(data.agency_id);
  const hasBrand =
    data.brand &&
    Object.keys(data.brand).length > 0 &&
    (data.brand.displayName || data.brand.logo_dark_url || data.brand.logo_url);

  if (!hasAgency && !hasBrand) {
    ctx.addIssue({
      code: "custom",
      message:
        "Provide agency_id (existing StayPacks account) or brand (displayName + logo) for clients without app access",
      path: ["brand"],
    });
  }
});

export type DeliveryTenantInput = z.infer<typeof deliveryTenantSchema>;
