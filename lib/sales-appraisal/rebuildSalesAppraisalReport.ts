import { buildSalesAppraisalReport } from "@/lib/sales-appraisal/buildSalesAppraisalReport";
import type { SalesAppraisalCopy } from "@/lib/sales-appraisal/deriveSalesAppraisalCopy";
import { mergeLeaseAppraisalCopyVariants } from "@/lib/lease-appraisal/mergeLeaseAppraisalCopyVariants";
import { resolveAgentProfile } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";
import type { ReportPropertyImageSelection } from "@/lib/reports/editable/reportImageSlots";
import type {
  Agency,
  AgentProfile,
  FinalReportJson,
  Listing,
  Report,
} from "@/lib/types";

export function rebuildSalesAppraisalFinalReport({
  agency,
  listing,
  report,
  copy,
  agencyAgents = [],
  templateId,
  propertyImages,
  existingFinalReport,
}: {
  agency: Agency;
  listing: Listing;
  report: Report;
  copy: SalesAppraisalCopy;
  agencyAgents?: AgentProfile[];
  templateId: string;
  propertyImages?: ReportPropertyImageSelection;
  existingFinalReport?: FinalReportJson | null;
}): FinalReportJson {
  const parsed = listing.scraped_listing_json;
  if (!parsed) {
    throw new Error("Import the listing URL before saving the appraisal");
  }

  if (!isSalesAppraisalTemplateId(templateId)) {
    throw new Error("Invalid sales appraisal template");
  }

  const agentProfile = resolveAgentProfile(listing, agencyAgents);

  const mergedCopy = mergeLeaseAppraisalCopyVariants(
    copy,
    existingFinalReport?.copy ?? (report.final_report_json as FinalReportJson | null)?.copy,
  );

  return resolveFinalReportForDisplay(
    buildSalesAppraisalReport({
      agency,
      listing,
      report,
      parsed,
      agentProfile,
      agencyAgents,
      templateId,
      copy: mergedCopy,
      propertyImages,
    }),
    { templateId },
  );
}
