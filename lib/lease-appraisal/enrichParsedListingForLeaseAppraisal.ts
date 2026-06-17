import {
  applyLeaseAppraisalCompSelection,
  defaultSelectedCompListingIds,
  hasLeaseAppraisalSelectedComps,
} from "@/lib/lease-appraisal/leaseAppraisalData";
import { enrichListingRentalAppraisal } from "@/lib/rental/enrichListingRentalAppraisal";
import { stripInternalRentalAppraisalWarnings } from "@/lib/rental/userFacingRentalWarnings";
import type { ParsedListing } from "@/lib/types";

export async function enrichParsedListingForLeaseAppraisal(
  parsed: ParsedListing,
): Promise<{ parsed: ParsedListing; warnings: string[] }> {
  let enrichedRaw = await enrichListingRentalAppraisal(parsed);
  if (!hasLeaseAppraisalSelectedComps(enrichedRaw)) {
    enrichedRaw = applyLeaseAppraisalCompSelection(
      enrichedRaw,
      defaultSelectedCompListingIds(enrichedRaw),
    );
  }
  const enriched = {
    ...enrichedRaw,
    warnings: stripInternalRentalAppraisalWarnings(enrichedRaw.warnings ?? []),
  };

  return {
    parsed: enriched,
    warnings: [...enriched.warnings],
  };
}
