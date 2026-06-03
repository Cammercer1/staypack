import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import type { ParsedListing } from "@/lib/types";

export function resolveRentalDisplayPrice(scraped?: ParsedListing | null) {
  const appraisal = scraped?.rentalAppraisal;
  if (
    appraisal?.weeklyMin != null &&
    appraisal?.weeklyMax != null &&
    appraisal.weeklyMin > 0 &&
    appraisal.weeklyMax > 0
  ) {
    return formatWeeklyRentRange(appraisal.weeklyMin, appraisal.weeklyMax);
  }

  if (appraisal?.weeklyMidpoint != null && appraisal.weeklyMidpoint > 0) {
    return formatWeeklyRentRange(
      appraisal.weeklyMidpoint,
      appraisal.weeklyMidpoint,
    );
  }

  return scraped?.displayPrice?.trim() || null;
}
