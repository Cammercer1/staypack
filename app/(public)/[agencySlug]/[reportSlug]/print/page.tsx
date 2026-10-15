import { publishedReportSnapshot } from "@/lib/reports/publicationSnapshot";
import { notFound, redirect } from "next/navigation";
import {
  agencySlugNeedsRedirect,
  resolveAgencyBySlug,
} from "@/lib/agencies/resolveAgencyBySlug";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { ReportPreview } from "@/components/reports/ReportPreview";

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
  return (
    <div className="report-print-root print-mode">
      <ReportPreview report={publishedReportSnapshot(report.final_report_json)} printMode />
    </div>
  );
}
