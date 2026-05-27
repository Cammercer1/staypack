import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { ReportPreview } from "@/components/reports/ReportPreview";
import type { FinalReportJson } from "@/lib/types";

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
    .select("id")
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

  return (
    <div className="print-mode">
      <ReportPreview
        report={report.final_report_json as FinalReportJson}
        printMode
      />
    </div>
  );
}
