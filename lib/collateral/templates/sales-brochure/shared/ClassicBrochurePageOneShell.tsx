import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import { mergeClassicBrochureMetricsReport } from "@/lib/collateral/templates/sales-brochure/shared/mergeClassicBrochureMetricsReport";
import { ClassicBrochurePageOneContent } from "@/lib/collateral/templates/sales-brochure/shared/ClassicBrochurePageOneContent";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";
import type { FinalReportJson } from "@/lib/types";

type Props = {
  document: BrochureDocumentJson;
  report: FinalReportJson;
  reportVariant?: ReportPageVariant;
  metricsReport?: FinalReportJson;
  compact?: boolean;
  pageFormat?: "a4-portrait" | "a4-landscape";
};

/**
 * Shared Classic page-one chrome (CSS page vars + flex column) — sale, STR, and lease
 * must use this wrapper or the hero gallery flex layout collapses.
 */
export function ClassicBrochurePageOneShell({
  document,
  report,
  reportVariant,
  metricsReport,
  compact = true,
  pageFormat = "a4-portrait",
}: Props) {
  const displayReport = metricsReport
    ? mergeClassicBrochureMetricsReport(report, {
        strReport: metricsReport,
        leaseReport: metricsReport,
      })
    : report;
  const brand = getReportBrandColours(displayReport.agency);
  const fmt = getCollateralPageFormat(pageFormat);

  return (
    <div
      className="sales-brochure-preview flex flex-col gap-0"
      style={{
        ["--report-page-width" as string]: fmt.width,
        ["--report-page-height" as string]: fmt.height,
      }}
    >
      <section
        className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
        style={{
          backgroundColor: brand.pageBackground,
          color: brand.text,
          width: "var(--report-page-width)",
          minHeight: "var(--report-page-height)",
        }}
      >
        <ClassicBrochurePageOneContent
          document={document}
          report={displayReport}
          reportVariant={reportVariant}
          compact={compact}
        />
      </section>
    </div>
  );
}
