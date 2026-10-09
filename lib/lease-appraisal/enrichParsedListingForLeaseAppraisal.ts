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
  options?: { subjectListingUrl?: string | null },
): Promise<{ parsed: ParsedListing; warnings: string[] }> {
  const input = { ...parsed, warnings: parsed.warnings.filter((warning) => !/^Rental appraisal (?:failed|skipped):/i.test(warning.trim())) };
  let enrichedRaw = await enrichListingRentalAppraisal(input, options);
  const failure = enrichedRaw.warnings.find((warning) => /^Rental appraisal (?:failed|skipped):/i.test(warning.trim()));
  if (failure) throw new Error(failure.replace(/^Rental appraisal (?:failed|skipped):\s*/i, ""));
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
