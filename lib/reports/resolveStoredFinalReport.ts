import { hydrateFinalReportBlurbVariants } from "@/lib/reports/hydrateFinalReportBlurbVariants";
import type { AiCopyJson, FinalReportJson, Report } from "@/lib/types";

type ReportWithFinalJson = Pick<Report, "final_report_json" | "ai_copy_json">;

/** Load final_report_json with blurb variants hydrated from ai_copy_json when needed. */
export function resolveStoredFinalReport(
  report: ReportWithFinalJson,
): FinalReportJson | null {
  if (!report.final_report_json) {
    return null;
  }

  const finalReport = report.final_report_json as FinalReportJson;
  return hydrateFinalReportBlurbVariants(
    finalReport,
    report.ai_copy_json as AiCopyJson | null,
  );
}
