import { z } from "zod";
import type { DeliveryTenant } from "@/lib/delivery/types";
import type { RentAppraisalTierSetting } from "@/lib/rental/detectPremiumRentSubject";

export const rentAppraisalConfigSchema = z.object({
  /** auto = score land/luxury copy; standard | premium = force tier */
  tier: z.enum(["auto", "standard", "premium"]).optional(),
});

export type RentAppraisalConfig = z.infer<typeof rentAppraisalConfigSchema>;

export function parseRentAppraisalConfig(
  featureFlags: Record<string, unknown> | null | undefined,
): RentAppraisalConfig | null {
  const raw = featureFlags?.rent_appraisal;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const parsed = rentAppraisalConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function rentAppraisalTierSetting(
  tenant: DeliveryTenant | null | undefined,
): RentAppraisalTierSetting | undefined {
  const config = parseRentAppraisalConfig(tenant?.feature_flags);
  return config?.tier;
}
