import { buildStrTemplatePreview } from "@/lib/reports/templatePreviewDocument";
import { resolveReportTemplateId } from "@/lib/reports/templates/resolveTemplateId";
import type { Agency, AgentProfile, Listing, Report } from "@/lib/types";
import type { StrAppraisal } from "@/lib/str-appraisals/types";
import { proposalFromReport } from "./data";

/** Read-only preview of saved inputs, including drafts that have not generated a PDF. */
export function reportForProposal({ agency, agencyAgents, listing, report, editable = false }: {
  editable?: boolean; agency: Agency; agencyAgents: AgentProfile[]; listing: Listing; report: Report;
}) {
  const document = !editable && report.status === "published" && report.final_report_json
    ? report.final_report_json
    : buildStrTemplatePreview({ agency, agencyAgents, listing, report, templateId: resolveReportTemplateId(agency, report) });
  const generatedAt = !editable && report.status === "published" ? document.generated_at : report.updated_at;
  return { ...document, generated_at: new Date(generatedAt).toISOString() };
}

export function proposalFromAppraisal(input: Parameters<typeof reportForProposal>[0] & {
  appraisal: Pick<StrAppraisal, "recipient_mode" | "recipient_name">;
}) {
  return proposalFromReport(reportForProposal(input), input.appraisal.recipient_mode === "named" ? input.appraisal.recipient_name : null);
}
