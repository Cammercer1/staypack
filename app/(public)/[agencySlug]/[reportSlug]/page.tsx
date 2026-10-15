import { publishedReportSnapshot } from "@/lib/reports/publicationSnapshot";
import { notFound, redirect } from "next/navigation";
import {
  agencySlugNeedsRedirect,
  resolveAgencyBySlug,
} from "@/lib/agencies/resolveAgencyBySlug";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { ReportPreview } from "@/components/reports/ReportPreview";

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
  const agency = await resolveAgencyBySlug(admin, agencySlug);

  if (!agency) {
    notFound();
  }

  if (agencySlugNeedsRedirect(agency, agencySlug)) {
    redirect(`/${agency.slug}/${reportSlug}`);
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
    <div className="min-h-screen bg-muted/40 py-10">
      <ReportPreview report={publishedReportSnapshot(report.final_report_json)} />
    </div>
  );
}
