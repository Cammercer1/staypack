"use client";

import { resolveReportCopyForTemplate } from "@/lib/copy/resolveCopyForTemplate";
import { applyBrandForTemplate } from "@/lib/branding/applyBrandForTemplate";
import { BellePageOneSpread } from "@/lib/collateral/templates/sales-brochure/belle/BelleLayout";
import { SALES_BROCHURE_BELLE_2PG_TEMPLATE_ID } from "@/lib/collateral/templates/ids";
import { finalReportToBrochureShape } from "@/lib/reports/finalReportToBrochureShape";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { ReportBrochureEditableLayer } from "@/components/reports/inline/ReportBrochureEditableBridge";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import type { ReportPageOneProps } from "@/lib/reports/templates/shared/reportPageVariant";
import { useMemo } from "react";

/** Belle STR / lease page 1 — isolated fork of Bold page 1 layout. */
export function BelleReportPageOne({ report, reportVariant }: ReportPageOneProps) {
  const displayReport = useMemo(() => {
    const withBrand = applyBrandForTemplate(report);
    return resolveReportCopyForTemplate(withBrand, {
      templateId: SALES_BROCHURE_BELLE_2PG_TEMPLATE_ID,
      collateral: reportVariant,
    });
  }, [report, reportVariant]);

  const document = useMemo(
    () => finalReportToBrochureShape(displayReport, reportVariant),
    [displayReport, reportVariant],
  );
  const brand = getReportBrandColours(displayReport.agency);

  return (
    <ReportBrochureEditableLayer report={displayReport} reportVariant={reportVariant}>
      <section
        className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
        style={{
          backgroundColor: brand.pageBackground,
          color: brand.text,
          height: "var(--report-page-height, 297mm)",
        }}
      >
        <BrochurePageShell brand={brand} className="!shadow-none">
          <div
            className="flex flex-col overflow-hidden"
            style={{ height: "var(--report-page-height, 297mm)" }}
          >
            <BellePageOneSpread document={document} report={displayReport} />
          </div>
        </BrochurePageShell>
      </section>
    </ReportBrochureEditableLayer>
  );
}
