import Link from "next/link";
import { notFound } from "next/navigation";
import { TemplatePlayground } from "@/components/dev/TemplatePlayground";
import { Button } from "@/components/ui/button";
import { requireReportAccess } from "@/lib/auth/requireUser";
import { resolvePlaygroundFinalReport } from "@/lib/reports/resolvePlaygroundFinalReport";

export const DEFAULT_PLAYGROUND_REPORT_ID =
  "b2a6028a-b7f9-44e7-86ec-4a263e2bc393";

export default async function DevTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ reportId?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { reportId = DEFAULT_PLAYGROUND_REPORT_ID } = await searchParams;

  const { supabase, agency, report } = await requireReportAccess(reportId);
  const finalReport = await resolvePlaygroundFinalReport(
    supabase,
    agency,
    report,
  );

  if (!finalReport) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Report missing preview data</h1>
          <p className="text-sm text-muted-foreground">
            This report needs an STR estimate and generated copy before it can
            be used as a template fixture. Finish the report wizard first, or
            pick a report that already has{" "}
            <code className="text-xs">final_report_json</code>.
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {reportId}
          </p>
          <Link href={`/reports/${reportId}`}>
            <Button variant="outline">Open report editor</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TemplatePlayground
      reportId={reportId}
      propertyAddress={report.property_address}
      baseReport={finalReport}
    />
  );
}
