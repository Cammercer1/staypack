import { notFound, redirect } from "next/navigation";
import {
  agencySlugNeedsRedirect,
  resolveAgencyBySlug,
} from "@/lib/agencies/resolveAgencyBySlug";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import { ReportPreview } from "@/components/reports/ReportPreview";
import type { Agency, FinalReportJson, Listing } from "@/lib/types";

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
  const agency = await resolveAgencyBySlug(admin, agencySlug);

  if (!agency) {
    notFound();
  }

  if (agencySlugNeedsRedirect(agency, agencySlug)) {
    redirect(`/${agency.slug}/${reportSlug}/print`);
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
    <div className="report-print-root print-mode">
      <ReportPreview report={finalReport} printMode />
    </div>
  );
}
