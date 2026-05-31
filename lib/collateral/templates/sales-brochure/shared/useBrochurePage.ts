import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import { getReportBrandColours } from "@/lib/reports/brandColours";

export function useBrochurePage(document: BrochureDocumentJson) {
  const report = salesBrochureToReportShape(document);
  const brand = getReportBrandColours(report.agency);

  const pageOneGallery = {
    ...report.property,
    hero_image_url:
      document.property.page_one_image_urls[0] ?? report.property.hero_image_url,
    selected_image_urls: document.property.page_one_image_urls.slice(1),
  };

  return {
    document,
    report,
    brand,
    pageOneGallery,
    pageTwoImages: document.property.page_two_image_urls.filter(Boolean),
  };
}

export const BROCHURE_PAGE_STYLE = {
  width: "var(--report-page-width, 210mm)",
  minHeight: "var(--report-page-height, 297mm)",
} as const;
