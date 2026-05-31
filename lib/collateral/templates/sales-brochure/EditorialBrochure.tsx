import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import { EditorialPageOneSpread } from "@/lib/collateral/templates/sales-brochure/EditorialBrochureOnePage";
import { BrochureGalleryPage } from "@/lib/collateral/templates/sales-brochure/shared/BrochureGalleryPage";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/**
 * Editorial · 2 pages — page 1 mirrors the single-page spread; page 2 is the
 * standardised photo-collage gallery closing on agent contact and a QR.
 */
export function EditorialBrochure({ document, pageFormat = "a4-portrait" }: CollateralTemplateProps) {
  if (!isBrochureDocument(document)) return null;

  const { report, brand, pageOneGallery } = useBrochurePage(document);
  const hero = pageOneGallery.hero_image_url;
  const fmt = getCollateralPageFormat(pageFormat);

  return (
    <div
      className="sales-brochure-preview flex flex-col"
      style={{
        ["--report-page-width" as string]: fmt.width,
        ["--report-page-height" as string]: fmt.height,
      }}
    >
      {/* Page 1 — shared editorial spread */}
      <BrochurePageShell brand={brand}>
        <div className="flex flex-col overflow-hidden" style={{ height: fmt.height }}>
          <EditorialPageOneSpread document={document} report={report} hero={hero} />
        </div>
      </BrochurePageShell>

      {/* Page 2 — standardised gallery + optional note + contact/QR */}
      <BrochurePageShell brand={brand}>
        <div className="flex flex-col overflow-hidden" style={{ height: fmt.height }}>
          <BrochureGalleryPage document={document} report={report} />
        </div>
      </BrochurePageShell>
    </div>
  );
}
