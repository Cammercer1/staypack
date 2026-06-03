import { notFound } from "next/navigation";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { getLeaseAppraisalPlaygroundReport } from "@/lib/lease-appraisal/leaseAppraisalPlayground";

/** Dev-only print view for Browserless PDF export (fixture data). */
export default function DevHavenLeaseAppraisalPrintPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const report = getLeaseAppraisalPlaygroundReport();

  return (
    <div className="report-print-root print-mode">
      <ReportPreview report={report} printMode />
    </div>
  );
}
