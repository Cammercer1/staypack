import { ClassicHeroGallery } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { ClassicPageHeader } from "@/lib/reports/templates/classic/ClassicPageHeader";
import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { SalesBrochurePropertySection } from "@/lib/collateral/templates/sales-brochure/SalesBrochurePropertySection";

type Props = {
  document: SalesBrochureDocumentJson;
};

export function ClassicSalesBrochurePageOne({ document }: Props) {
  const report = salesBrochureToReportShape(document);
  const brand = getReportBrandColours(report.agency);
  const pageOneProperty = {
    ...report.property,
    hero_image_url: document.property.page_one_image_urls[0] ?? report.property.hero_image_url,
    selected_image_urls: document.property.page_one_image_urls.slice(1),
  };

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
        <ClassicHeroGallery property={pageOneProperty} />
      </div>
      <SalesBrochurePropertySection document={document} />
    </section>
  );
}
