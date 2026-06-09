import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import { BrochurePageOneHeroGallery } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageOneHeroGallery";
import { ClassicPageHeader } from "@/lib/reports/templates/classic/ClassicPageHeader";
import { SalesBrochurePropertySection } from "@/lib/collateral/templates/sales-brochure/SalesBrochurePropertySection";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";
import type { FinalReportJson } from "@/lib/types";

/** Classic sales-brochure page-one body (header, gallery, property, agent). */
export function ClassicBrochurePageOneContent({
  document,
  report,
  compact = true,
  reportVariant,
}: {
  document: BrochureDocumentJson;
  report: FinalReportJson;
  compact?: boolean;
  reportVariant?: ReportPageVariant;
}) {
  return (
    <>
      <ClassicPageHeader report={report} />
      <div
        className="min-h-0 flex-[1.35]"
        style={{
          minHeight: "calc(var(--report-page-height, 297mm) * 0.38)",
        }}
      >
        <BrochurePageOneHeroGallery document={document} />
      </div>
      <SalesBrochurePropertySection
        document={document}
        report={report}
        reportVariant={reportVariant}
        compact={compact}
      />
      <ClassicAgentFooter report={report} compact={compact} />
    </>
  );
}
