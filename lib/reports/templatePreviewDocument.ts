import {
  buildFinalReportJson,
  getMockAiCopy,
} from "@/lib/reports/buildFinalReportJson";
import { finalReportCopyToAiCopy } from "@/lib/reports/editable/strReportCopyAdapter";
import { preserveReportImages } from "@/lib/reports/invalidateReportPdf";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import type {
  Agency,
  AgentProfile,
  Listing,
  Report,
  StrEstimate,
} from "@/lib/types";

const pendingEstimate: StrEstimate = {
  annualRevenue: null,
  monthlyRevenue: null,
  weeklyRevenue: null,
  nightlyRate: null,
  occupancyRate: null,
  bookedNights: null,
  radiusM: null,
  raw: null,
};

export function buildStrTemplatePreview({
  agency,
  agencyAgents,
  listing,
  report,
  templateId,
}: {
  agency: Agency;
  agencyAgents: AgentProfile[];
  listing: Listing;
  report: Report;
  templateId: string;
}) {
  return resolveFinalReportForDisplay(
    buildFinalReportJson({
      agency,
      agencyAgents,
      listing,
      report: { ...report, template_id: templateId },
      estimate: report.final_estimate_json ?? pendingEstimate,
      copy:
        report.ai_copy_json ??
        (report.final_report_json
          ? finalReportCopyToAiCopy(report.final_report_json.copy, null)
          : getMockAiCopy(listing, agency)),
      propertyImages: preserveReportImages(report.final_report_json),
    }),
  );
}
