import { resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";
import { buildLeaseAppraisalReport } from "@/lib/lease-appraisal/buildLeaseAppraisalReport";
import type { LeaseAppraisalCopy } from "@/lib/lease-appraisal/deriveLeaseAppraisalCopy";
import { mergeLeaseAppraisalCopyVariants } from "@/lib/lease-appraisal/mergeLeaseAppraisalCopyVariants";
import { resolveAgentProfile } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import type { ReportPropertyImageSelection } from "@/lib/reports/editable/reportImageSlots";
import type {
  Agency,
  AgentProfile,
  FinalReportJson,
  Listing,
  Report,
} from "@/lib/types";

export function rebuildLeaseAppraisalFinalReport({
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
  copy: LeaseAppraisalCopy;
  agencyAgents?: AgentProfile[];
  templateId: string;
  propertyImages?: ReportPropertyImageSelection;
  existingFinalReport?: FinalReportJson | null;
}): FinalReportJson {
  const parsed = resolveAppraisalInput(listing);

  if (!isLeaseAppraisalTemplateId(templateId)) {
    throw new Error("Invalid lease appraisal template");
  }

  const agentProfile = resolveAgentProfile(listing, agencyAgents);

  const mergedCopy = mergeLeaseAppraisalCopyVariants(
    copy,
    existingFinalReport?.copy ?? (report.final_report_json as FinalReportJson | null)?.copy,
  );

  return resolveFinalReportForDisplay(
    buildLeaseAppraisalReport({
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
