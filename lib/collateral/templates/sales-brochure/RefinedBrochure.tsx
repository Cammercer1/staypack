import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import {
  RefinedAgentBar,
  RefinedPageTwoGallery,
  RefinedSpread,
} from "@/lib/collateral/templates/sales-brochure/refined/RefinedLayout";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/** Refined · 2 pages — page 1 property overview; page 2 photo mosaic + agent. */
export function RefinedBrochure({ document }: { document: CollateralDocumentJson }) {
  if (!isSalesBrochureDocument(document)) return null;

  const { report, brand, pageTwoImages } = useBrochurePage(document);
  const pageTwo = pageTwoImages.filter(Boolean);

  return (
    <div
      className="sales-brochure-preview flex flex-col"
      style={{
        ["--report-page-width" as string]: "210mm",
        ["--report-page-height" as string]: "297mm",
      }}
    >
      <BrochurePageShell brand={brand}>
        <div className="flex min-h-[297mm] flex-col">
          <RefinedSpread document={document} report={report} />
        </div>
      </BrochurePageShell>

      <BrochurePageShell brand={brand}>
        <div className="flex h-[297mm] flex-col overflow-hidden">
          <div className="min-h-0 flex-1 px-8 pb-4 pt-8">
            <RefinedPageTwoGallery urls={pageTwo} />
          </div>
          <RefinedAgentBar document={document} report={report} pinnedBottom />
        </div>
      </BrochurePageShell>
    </div>
  );
}
