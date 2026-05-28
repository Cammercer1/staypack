import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import { ClassicHeroGallery } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { ClassicPageHeader } from "@/lib/reports/templates/classic/ClassicPageHeader";
import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { SalesBrochurePropertySection } from "@/lib/collateral/templates/sales-brochure/SalesBrochurePropertySection";

type Props = {
  document: CollateralDocumentJson;
};

/** Single-page Classic sales brochure (gallery, copy, agent + QR on one A4). */
export function ClassicSalesBrochureOnePage({ document }: Props) {
  if (!isSalesBrochureDocument(document)) {
    return null;
  }

  const report = salesBrochureToReportShape(document);
  const brand = getReportBrandColours(report.agency);
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
        ["--report-page-width" as string]: "210mm",
        ["--report-page-height" as string]: "297mm",
      }}
    >
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
