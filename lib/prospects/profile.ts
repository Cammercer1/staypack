import { z } from "zod";
import { assignmentSchema } from "@/lib/digital-proposals/assignment";
import { proposalAgentSchema } from "@/lib/digital-proposals/data";
import { deliveryTenantBrandSchema } from "@/lib/delivery/brand/schema";
import { agencyFromTenantBrand } from "@/lib/delivery/brand/mergeAgencyBrand";
import { strManagementAssumptionsSchema, strUpliftPercentSchema } from "@/lib/reports/strEstimateAdjustments";

/** A reusable brand, independent of agencies, Auth accounts and memberships. */
export const prospectProfileSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
  brand: deliveryTenantBrandSchema,
  upliftPercent: strUpliftPercentSchema,
  assumptions: strManagementAssumptionsSchema,
  contacts: z.array(proposalAgentSchema).max(3).default([]),
  assignment: assignmentSchema,
  sources: z.array(z.string().url()).max(20),
}).strict().superRefine((profile, ctx) => {
  if (profile.assignment.defaults.agentIds.length || profile.assignment.defaults.attachmentIds.length)
    ctx.addIssue({ code: "custom", message: "Prospect designs cannot reference customer agents or attachments." });
});
export type ProspectProfile = z.infer<typeof prospectProfileSchema>;

export const prospectPropertyOverridesSchema = z.object({
  car_spaces: z.number().int().min(0).max(30).optional(),
  accommodates: z.number().int().min(1).max(50).optional(),
  selected_image_urls: z.array(z.string().url()).min(5).max(25).optional(),
  hero_image_url: z.string().url().optional(),
}).strict();

/** Adapter for the existing report builder; never inserted into agencies. */
export function prospectAgency(profile: ProspectProfile, brandId: string) {
  const agency = agencyFromTenantBrand(profile.slug, profile.name, { ...profile.brand, displayName: profile.name }, brandId);
  return { ...agency, str_management_presets: [{
    id: brandId, name: `${profile.name} management uplift`.slice(0, 80),
    mode: "uplift" as const, isDefault: true, upliftPercent: profile.upliftPercent, assumptions: profile.assumptions,
  }] };
}
