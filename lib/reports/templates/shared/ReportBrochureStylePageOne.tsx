"use client";

import { BoldPageOneSpread } from "@/lib/collateral/templates/sales-brochure/bold/BoldLayout";
import { EditorialPageOneSpread } from "@/lib/collateral/templates/sales-brochure/EditorialBrochureOnePage";
import { GalleryPageOneSpread } from "@/lib/collateral/templates/sales-brochure/gallery/GalleryLayout";
import { LandmarkSpread } from "@/lib/collateral/templates/sales-brochure/landmark/LandmarkLayout";
import { MinimalistSpread } from "@/lib/collateral/templates/sales-brochure/minimalist/MinimalistLayout";
import { RefinedSpread } from "@/lib/collateral/templates/sales-brochure/refined/RefinedLayout";
import { ClassicBrochurePageOneShell } from "@/lib/collateral/templates/sales-brochure/shared/ClassicBrochurePageOneShell";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { SplitSpreadLayout } from "@/lib/collateral/templates/sales-brochure/split/SplitLayout";
import { resolveReportCopyForTemplate } from "@/lib/copy/resolveCopyForTemplate";
import { applyBrandForTemplate } from "@/lib/branding/applyBrandForTemplate";
import { finalReportToBrochureShape } from "@/lib/reports/finalReportToBrochureShape";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { salesBrochureTemplateIdForFamily } from "@/lib/reports/templates/salesBrochureFamilyMap";
import { ReportBrochureEditableLayer } from "@/components/reports/inline/ReportBrochureEditableBridge";
import type { ReportPageOneProps } from "@/lib/reports/templates/shared/reportPageVariant";
import { useMemo, type ReactNode } from "react";

export type ReportBrochureLayoutFamily =
  | "classic"
  | "bold"
  | "gallery"
  | "editorial"
  | "split"
  | "refined"
  | "minimalist"
  | "landmark";

type Props = ReportPageOneProps & {
  family: ReportBrochureLayoutFamily;
};

/**
 * STR / lease page 1 — same layout as the matching sales-brochure one-pager.
 * Edit the brochure spread files under lib/collateral/templates/sales-brochure/.
 */
export function ReportBrochureStylePageOne({ report, reportVariant, family }: Props) {
  const brochureTemplateId = salesBrochureTemplateIdForFamily(family, 1);
  const displayReport = useMemo(() => {
    const withBrand = applyBrandForTemplate(report);
    return resolveReportCopyForTemplate(withBrand, {
      templateId: brochureTemplateId,
      collateral: reportVariant,
    });
  }, [report, brochureTemplateId, reportVariant]);
  const document = useMemo(
    () => finalReportToBrochureShape(displayReport, reportVariant),
    [displayReport, reportVariant],
  );
  const brand = getReportBrandColours(displayReport.agency);
  const hero =
    document.property.page_one_image_urls[0] ?? document.property.hero_image_url ?? "";

  function withInlineEdit(layer: ReactNode) {
    return (
      <ReportBrochureEditableLayer report={displayReport} reportVariant={reportVariant}>
        {layer}
      </ReportBrochureEditableLayer>
    );
  }

  if (family === "classic") {
    return withInlineEdit(
      <ClassicBrochurePageOneShell
        document={document}
        report={displayReport}
        reportVariant={reportVariant}
      />,
    );
  }

  return withInlineEdit(
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
          {family === "bold" ? (
            <BoldPageOneSpread document={document} report={displayReport} />
          ) : null}
          {family === "gallery" ? (
            <GalleryPageOneSpread document={document} report={displayReport} />
          ) : null}
          {family === "editorial" ? (
            <EditorialPageOneSpread document={document} report={displayReport} hero={hero} />
          ) : null}
          {family === "split" ? (
            <SplitSpreadLayout document={document} report={displayReport} />
          ) : null}
          {family === "refined" ? (
            <RefinedSpread document={document} report={displayReport} />
          ) : null}
          {family === "minimalist" ? (
            <MinimalistSpread document={document} report={displayReport} />
          ) : null}
          {family === "landmark" ? (
            <LandmarkSpread document={document} report={displayReport} />
          ) : null}
        </div>
      </BrochurePageShell>
    </section>,
  );
}
