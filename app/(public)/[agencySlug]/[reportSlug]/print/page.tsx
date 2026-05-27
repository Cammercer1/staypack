import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import { ReportPreview } from "@/components/reports/ReportPreview";
import type { Agency, FinalReportJson } from "@/lib/types";

export default async function PublicReportPrintPage({
  params,
}: {
  params: Promise<{ agencySlug: string; reportSlug: string }>;
}) {
  const { agencySlug, reportSlug } = await params;

  if (!hasServiceRoleKey()) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: agency } = await admin
    .from("agencies")
    .select("*")
    .eq("slug", agencySlug)
    .maybeSingle();

  if (!agency) {
    notFound();
  }

  const { data: report } = await admin
    .from("reports")
    .select("final_report_json, status, display_price, scraped_listing_json")
    .eq("agency_id", agency.id)
    .eq("public_slug", reportSlug)
    .eq("status", "published")
    .maybeSingle();

  if (!report?.final_report_json) {
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
