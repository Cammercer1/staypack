import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import { ClassicHeroGallery } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { ClassicPageHeader } from "@/lib/reports/templates/classic/ClassicPageHeader";
import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { SalesBrochurePropertySection } from "@/lib/collateral/templates/sales-brochure/SalesBrochurePropertySection";

/** Single-page Classic sales brochure (gallery, copy, agent + QR on one A4). */
export function ClassicSalesBrochureOnePage({ document, pageFormat = "a4-portrait" }: CollateralTemplateProps) {
  if (!isSalesBrochureDocument(document)) {
    return null;
  }

  const report = salesBrochureToReportShape(document);
  const brand = getReportBrandColours(report.agency);
  const fmt = getCollateralPageFormat(pageFormat);
  const pageOneProperty = {
    ...report.property,
    hero_image_url:
      document.property.page_one_image_urls[0] ?? report.property.hero_image_url,
    selected_image_urls: document.property.page_one_image_urls.slice(1, 4),
  };

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
        <ClassicPageHeader report={report} />
        <div className="min-h-0 flex-[1.35]">
          <ClassicHeroGallery property={pageOneProperty} />
        </div>
        <SalesBrochurePropertySection document={document} compact />
        {document.copy.inspection_cta ? (
          <p className="shrink-0 px-10 pb-2 text-base font-semibold text-neutral-900">
            {document.copy.inspection_cta}
          </p>
        ) : null}
        <ClassicAgentFooter report={report} />
      </section>
    </div>
  );
}
