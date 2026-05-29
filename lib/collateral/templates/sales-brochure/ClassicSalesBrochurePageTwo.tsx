import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { BrochureGalleryPage } from "@/lib/collateral/templates/sales-brochure/shared/BrochureGalleryPage";

type Props = {
  document: SalesBrochureDocumentJson;
};

/** Page 2 — standardised photo collage (scaled to image count) + optional note + contact/QR. */
export function ClassicSalesBrochurePageTwo({ document }: Props) {
  const report = salesBrochureToReportShape(document);
  const brand = getReportBrandColours(report.agency);

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        width: "var(--report-page-width, 210mm)",
        height: "var(--report-page-height, 297mm)",
      }}
    >
      <BrochureGalleryPage document={document} report={report} />
    </section>
  );
}
