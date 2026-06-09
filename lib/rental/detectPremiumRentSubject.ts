import type { RentBandTier } from "@/lib/rental/computeRentBand";
import { propertyTypeFamily } from "@/lib/rental/computeRentBand";
import type { ListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import { LARGE_LAND_SQM, PREMIUM_LAND_SQM } from "@/lib/rental/parseListingPremiumSignals";

export type RentAppraisalTierSetting = "auto" | RentBandTier;

export type PremiumRentSubjectInput = {
  tier?: RentBandTier;
  tierSetting?: RentAppraisalTierSetting;
  subjectBedrooms?: number;
  subjectBathrooms?: number;
  subjectPropertyType?: string;
  signals?: ListingPremiumSignals;
};

export type PremiumRentSubjectResult = {
  premium: boolean;
  reasons: string[];
};

/**
 * Premium tier is scored from land, luxury copy, and bath count — not beds alone.
 * Threshold: score >= 3, or tenant forced premium.
 */
export function detectPremiumRentSubject(
  input: PremiumRentSubjectInput,
): PremiumRentSubjectResult {
  if (input.tierSetting === "premium" || input.tier === "premium") {
    return { premium: true, reasons: ["tenant rent_appraisal tier override"] };
  }
  if (input.tierSetting === "standard" || input.tier === "standard") {
    return { premium: false, reasons: [] };
  }

  const signals = input.signals;
  const beds = input.subjectBedrooms;
  const baths = input.subjectBathrooms;
  const typeFamily = propertyTypeFamily(input.subjectPropertyType);
  let score = 0;
  const reasons: string[] = [];

  if (typeFamily === "unit" && (signals?.luxuryScore ?? 0) >= 2) {
    score += 2;
    reasons.push("luxury apartment/unit copy");
  } else if (typeFamily === "unit" && (signals?.luxuryScore ?? 0) >= 1) {
    score += 1;
    reasons.push("premium unit listing language");
  }

  if (signals?.premiumLand) {
    score += 2;
    reasons.push(`large land (${signals.landAreaSqm} m²)`);
  } else if (signals?.largeLand) {
    score += 1;
    reasons.push(`generous land (${signals.landAreaSqm} m²)`);
  }

  if ((signals?.luxuryScore ?? 0) >= 3) {
    score += 2;
    reasons.push("strong luxury listing language");
  } else if ((signals?.luxuryScore ?? 0) >= 1) {
    score += 1;
    reasons.push("luxury listing language");
  }

  if (baths != null && baths >= 4) {
    score += 1;
    reasons.push(`${baths} bathrooms`);
  }

  if (beds != null && beds >= 5 && baths != null && baths >= 3 && (signals?.luxuryScore ?? 0) >= 1) {
    score += 1;
    reasons.push("large home with premium copy");
  }

  if (
    beds != null &&
    beds >= 5 &&
    baths != null &&
    baths >= 3 &&
    (signals?.landAreaSqm ?? 0) >= LARGE_LAND_SQM
  ) {
    score += 1;
    reasons.push("large home on substantial land");
  }

  return {
    premium: score >= 3,
    reasons,
  };
}

export { PREMIUM_LAND_SQM, LARGE_LAND_SQM };
