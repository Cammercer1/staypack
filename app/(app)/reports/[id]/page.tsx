import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/auth/requireUser";
import { ReportEditor } from "@/components/reports/ReportEditor";
import type { Report } from "@/lib/types";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, agency } = await requireAgency();

  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .eq("agency_id", agency.id)
    .maybeSingle();

  if (!report) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">
          {report.property_address ?? "Report editor"}
        </h1>
        <p className="text-muted-foreground">
          Continue building and publishing this STR potential report.
        </p>
      </div>
      <ReportEditor initialReport={report as Report} agency={agency} />
    </div>
  );
}
