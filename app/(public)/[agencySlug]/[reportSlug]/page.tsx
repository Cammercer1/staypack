import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import { ReportPreview } from "@/components/reports/ReportPreview";
import type { Agency, FinalReportJson, Listing } from "@/lib/types";

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ agencySlug: string; reportSlug: string }>;
}) {
  const { agencySlug, reportSlug } = await params;

  if (!hasServiceRoleKey()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">
          Configure Supabase service role credentials to view published reports.
        </p>
      </div>
    );
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
    .select("final_report_json, status, listing_id")
    .eq("agency_id", agency.id)
    .eq("public_slug", reportSlug)
    .eq("status", "published")
    .maybeSingle();

  if (!report?.final_report_json || !report.listing_id) {
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

  const finalReport = enrichFinalReportMetrics(
    (listing ?? { display_price: null, scraped_listing_json: null }) as Pick<
      Listing,
      "display_price" | "scraped_listing_json"
    >,
    mergeAgencyBrandIntoFinalReport(
      agency as Agency,
      report.final_report_json as FinalReportJson,
    ),
    { agentProfile, agencyAgents: agencyAgents ?? [] },
  );

  return (
    <div className="min-h-screen bg-muted/40 py-10">
      <ReportPreview report={finalReport} />
    </div>
  );
}
