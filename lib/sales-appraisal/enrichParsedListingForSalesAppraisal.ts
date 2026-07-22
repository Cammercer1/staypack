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
  let enrichedRaw = await enrichListingSalesAppraisal(parsed, options);
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
