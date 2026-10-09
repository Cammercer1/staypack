import {
  applySalesAppraisalCompSelection,
  defaultSelectedSaleCompListingIds,
  hasSalesAppraisalSelectedComps,
} from "@/lib/sales-appraisal/salesAppraisalData";
import { enrichListingSalesAppraisal } from "@/lib/sales/enrichListingSalesAppraisal";
import { stripInternalSalesAppraisalWarnings } from "@/lib/sales/userFacingSalesWarnings";
import type { ParsedListing } from "@/lib/types";

export async function enrichParsedListingForSalesAppraisal(
  parsed: ParsedListing,
  options?: { subjectListingUrl?: string | null },
): Promise<{ parsed: ParsedListing; warnings: string[] }> {
  const input = { ...parsed, warnings: parsed.warnings.filter((warning) => !/^Sales appraisal (?:failed|skipped):/i.test(warning.trim())) };
  let enrichedRaw = await enrichListingSalesAppraisal(input, options);
  const failure = enrichedRaw.warnings.find((warning) => /^Sales appraisal (?:failed|skipped):/i.test(warning.trim()));
  if (failure) throw new Error(failure.replace(/^Sales appraisal (?:failed|skipped):\s*/i, ""));
  if (!hasSalesAppraisalSelectedComps(enrichedRaw)) {
    enrichedRaw = applySalesAppraisalCompSelection(
      enrichedRaw,
      defaultSelectedSaleCompListingIds(enrichedRaw),
    );
  }
  const enriched = {
    ...enrichedRaw,
    warnings: stripInternalSalesAppraisalWarnings(enrichedRaw.warnings ?? []),
  };

  return {
    parsed: enriched,
    warnings: [...enriched.warnings],
  };
}
