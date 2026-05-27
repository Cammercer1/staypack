import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { verifyPrintAccessToken } from "@/lib/reports/printAccessToken";
import { ReportPreview } from "@/components/reports/ReportPreview";
import type { Agency, FinalReportJson } from "@/lib/types";

export default async function DraftReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { reportId } = await params;
  const { token } = await searchParams;

  if (!hasServiceRoleKey() || !token || !verifyPrintAccessToken(reportId, token)) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: report } = await admin
    .from("reports")
    .select("final_report_json, agency_id")
    .eq("id", reportId)
    .maybeSingle();

  if (!report?.final_report_json) {
    notFound();
  }

  const { data: agency } = await admin
    .from("agencies")
    .select("*")
    .eq("id", report.agency_id)
    .maybeSingle();

  if (!agency) {
    notFound();
  }

  const finalReport = mergeAgencyBrandIntoFinalReport(
    agency as Agency,
    report.final_report_json as FinalReportJson,
  );

  return (
    <div className="report-print-root print-mode">
      <ReportPreview report={finalReport} printMode />
    </div>
  );
}
