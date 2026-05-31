import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import {
  GalleryMinimalAgentBar,
  GalleryPageOneSpread,
} from "@/lib/collateral/templates/sales-brochure/gallery/GalleryLayout";
import { RefinedPageTwoGallery } from "@/lib/collateral/templates/sales-brochure/refined/RefinedLayout";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/** Gallery · 2 pages — Ray White–style page 1; photo mosaic + agent page 2. */
export function GalleryBrochure({ document, pageFormat = "a4-portrait" }: CollateralTemplateProps) {
  if (!isBrochureDocument(document)) return null;

  const { report, brand, pageTwoImages } = useBrochurePage(document);
  const pageTwo = pageTwoImages.filter(Boolean);
  const fmt = getCollateralPageFormat(pageFormat);

  return (
    <div
      className="sales-brochure-preview flex flex-col"
      style={{
        ["--report-page-width" as string]: fmt.width,
        ["--report-page-height" as string]: fmt.height,
      }}
    >
      <BrochurePageShell brand={brand}>
        <div className="flex flex-col overflow-hidden" style={{ height: fmt.height }}>
          <GalleryPageOneSpread document={document} report={report} />
        </div>
      </BrochurePageShell>

      <BrochurePageShell brand={brand}>
        <div className="flex flex-col overflow-hidden" style={{ height: fmt.height }}>
          <div className="min-h-0 flex-1 px-8 pb-4 pt-8">
            <RefinedPageTwoGallery urls={pageTwo} />
          </div>
          <GalleryMinimalAgentBar document={document} report={report} pinnedBottom />
        </div>
      </BrochurePageShell>
    </div>
  );
}
