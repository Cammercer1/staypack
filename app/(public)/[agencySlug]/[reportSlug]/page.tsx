import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { ReportPreview } from "@/components/reports/ReportPreview";
import type { Agency, FinalReportJson } from "@/lib/types";

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
    .select("final_report_json, status")
    .eq("agency_id", agency.id)
    .eq("public_slug", reportSlug)
    .eq("status", "published")
    .maybeSingle();

  if (!report?.final_report_json) {
    notFound();
  }

  const finalReport = mergeAgencyBrandIntoFinalReport(
    agency as Agency,
    report.final_report_json as FinalReportJson,
  );

  return (
    <div className="min-h-screen bg-muted/40 py-10">
      <ReportPreview report={finalReport} />
    </div>
  );
}
