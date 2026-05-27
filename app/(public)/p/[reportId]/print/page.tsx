import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
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
    .select("final_report_json, agency_id, display_price, scraped_listing_json")
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

  const { data: agencyAgents } = await admin
    .from("agent_profiles")
    .select("*")
    .eq("agency_id", agency.id);

  const finalReport = enrichFinalReportMetrics(
    report,
    mergeAgencyBrandIntoFinalReport(
      agency as Agency,
      report.final_report_json as FinalReportJson,
    ),
    { agencyAgents: agencyAgents ?? [] },
  );

  return (
    <div className="report-print-root print-mode">
      <ReportPreview report={finalReport} printMode />
    </div>
  );
}
