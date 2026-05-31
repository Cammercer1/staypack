import { BrochurePageOneHeroGallery } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageOneHeroGallery";
import { ClassicPageHeader } from "@/lib/reports/templates/classic/ClassicPageHeader";
import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { SalesBrochurePropertySection } from "@/lib/collateral/templates/sales-brochure/SalesBrochurePropertySection";

type Props = {
  document: BrochureDocumentJson;
};

export function ClassicSalesBrochurePageOne({ document }: Props) {
  const report = salesBrochureToReportShape(document);
  const brand = getReportBrandColours(report.agency);
  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        width: "var(--report-page-width, 210mm)",
        minHeight: "var(--report-page-height, 297mm)",
      }}
    >
      <ClassicPageHeader report={report} />
      <div className="min-h-0 flex-1">
        <BrochurePageOneHeroGallery document={document} />
      </div>
      <SalesBrochurePropertySection document={document} />
    </section>
  );
}
