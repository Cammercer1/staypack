import type { FinalReportJson } from "@/lib/types";

/** Content changes invalidate both references used by delivery and the saved document. */
export function invalidateReportPdf<
  T extends { assets?: Record<string, unknown> },
>(document: T): T {
  return { ...document, assets: { ...document.assets, pdf_url: "" } };
}

export function preserveReportImages(document: FinalReportJson | null) {
  return document?.property
    ? {
        hero_image_url: document.property.hero_image_url,
        selected_image_urls: document.property.selected_image_urls,
      }
    : null;
}
