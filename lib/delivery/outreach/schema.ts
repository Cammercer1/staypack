import { z } from "zod";
import { isValidCollateralTemplateId, isSalesBrochureTemplateId } from "@/lib/collateral/templates/ids";
import { selectableStrTemplateIdSchema } from "@/lib/delivery/outreach/strTemplateId";
import { LEASE_APPRAISAL_TEMPLATE_IDS } from "@/lib/reports/templates/lease-appraisal/ids";

export const OUTREACH_DELIVERABLES = [
  "str",
  "lease_appraisal",
  "sales_brochure",
] as const;

export type OutreachDeliverable = (typeof OUTREACH_DELIVERABLES)[number];

const leaseAppraisalTemplateIdSchema = z.string().refine(
  (id) => (LEASE_APPRAISAL_TEMPLATE_IDS as readonly string[]).includes(id),
  { message: "Invalid lease appraisal template id" },
);

const salesBrochureTemplateIdSchema = z.string().refine(
  (id) => isValidCollateralTemplateId(id) && isSalesBrochureTemplateId(id),
  { message: "Invalid sales brochure template id" },
);

const rentOverrideSchema = z
  .object({
    weekly_low: z.number().positive().optional(),
    weekly_median: z.number().positive().optional(),
    weekly_high: z.number().positive().optional(),
  })
  .refine(
    (value) =>
      value.weekly_low == null ||
      value.weekly_high == null ||
      value.weekly_low <= value.weekly_high,
    { message: "weekly_low must be less than or equal to weekly_high" },
  );

export const outreachGenerateRequestSchema = z.object({
  tenant_slug: z.string().min(1),
  listing_url: z.string().url(),
  address: z.string().optional(),
  deliverables: z
    .array(z.enum(OUTREACH_DELIVERABLES))
    .default(["str", "lease_appraisal", "sales_brochure"]),
  templates: z
    .object({
      str: selectableStrTemplateIdSchema.optional(),
      lease_appraisal: leaseAppraisalTemplateIdSchema.optional(),
      sales_brochure: salesBrochureTemplateIdSchema.optional(),
    })
    .optional(),
  agent_profile_ids: z.array(z.string().uuid()).max(2).optional(),
  /** Lease appraisal indicative weekly rent overrides; comps still come from enrichment. */
  rent_override: rentOverrideSchema.optional(),
  skip_ledger: z.boolean().default(true),
});

export type OutreachGenerateRequest = z.infer<typeof outreachGenerateRequestSchema>;
