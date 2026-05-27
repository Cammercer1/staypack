import { requireAgency } from "@/lib/auth/requireUser";
import { ReportListingEntry } from "@/components/reports/ReportListingEntry";
import type { Report } from "@/lib/types";

export default async function NewReportPage() {
  const { supabase, agency, user } = await requireAgency();

  const { data: report } = await supabase
    .from("reports")
    .insert({
      agency_id: agency.id,
      created_by: user.id,
      status: "draft",
    })
    .select("*")
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Create report</h1>
        <p className="text-muted-foreground">
          Paste a listing URL to import details, or enter the property manually.
        </p>
      </div>
      <ReportListingEntry report={report as Report} redirectOnComplete />
    </div>
  );
}
