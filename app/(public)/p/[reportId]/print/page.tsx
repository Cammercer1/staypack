import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import { resolveFinalReportForPrint } from "@/lib/reports/resolveFinalReportForPrint";
import { resolveStoredFinalReport } from "@/lib/reports/resolveStoredFinalReport";
import { verifyPrintAccessToken } from "@/lib/reports/printAccessToken";
import { ReportPreview } from "@/components/reports/ReportPreview";
import type { Agency, FinalReportJson, Listing } from "@/lib/types";

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
    .select("final_report_json, agency_id, listing_id, template_id")
    .eq("id", reportId)
    .maybeSingle();

  if (!report?.final_report_json || !report.listing_id) {
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

  const { data: listing } = await admin
    .from("listings")
    .select("display_price, scraped_listing_json, agent_profile_id")
    .eq("id", report.listing_id)
    .maybeSingle();

  const { data: agencyAgents } = await admin
    .from("agent_profiles")
    .select("*")
    .eq("agency_id", agency.id);

  const agentProfile =
    listing?.agent_profile_id != null
      ? agencyAgents?.find((agent) => agent.id === listing.agent_profile_id) ?? null
      : null;

  const storedReport =
    resolveStoredFinalReport(report) ??
    (report.final_report_json as FinalReportJson);
  const mergedForPrint = resolveFinalReportForPrint(
    report,
    listing as Listing | null,
    storedReport,
  );

  const finalReport = enrichFinalReportMetrics(
    (listing ?? { display_price: null, scraped_listing_json: null }) as Pick<
      Listing,
      "display_price" | "scraped_listing_json"
    >,
    mergeAgencyBrandIntoFinalReport(agency as Agency, mergedForPrint),
    { agentProfile, agencyAgents: agencyAgents ?? [] },
  );

  return (
    <div className="report-print-root print-mode">
      <ReportPreview report={finalReport} printMode />
    </div>
  );
}
