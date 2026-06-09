import { ClassicBrochurePageOneShell } from "@/lib/collateral/templates/sales-brochure/shared/ClassicBrochurePageOneShell";
import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import type { CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isBrochureDocument } from "@/lib/collateral/templates/types";

/** Single-page Classic sales brochure (gallery, copy, agent + QR on one A4). */
export function ClassicSalesBrochureOnePage({
  document,
  pageFormat = "a4-portrait",
  metricsReport,
  reportVariant,
}: CollateralTemplateProps) {
  if (!isBrochureDocument(document)) {
    return null;
  }

  const report = salesBrochureToReportShape(document);

  return (
    <ClassicBrochurePageOneShell
      document={document}
      report={report}
      metricsReport={metricsReport}
      reportVariant={reportVariant}
      pageFormat={pageFormat}
    />
  );
}
