import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { BoldPageOneSpread } from "@/lib/collateral/templates/sales-brochure/bold/BoldLayout";
import {
  BrochureBulletList,
  BrochurePhotoGrid,
} from "@/lib/collateral/templates/sales-brochure/shared/BrochureCopyBlocks";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/** Bold · 2 pages — commercial-style page 1; highlights + gallery page 2. */
export function BoldBrochure({ document }: { document: CollateralDocumentJson }) {
  if (!isSalesBrochureDocument(document)) return null;

  const { report, brand, pageTwoImages } = useBrochurePage(document);
  const primary = document.agency.primary_colour;
  const accent = document.agency.accent_colour;

  return (
    <div
      className="sales-brochure-preview flex flex-col"
      style={{
        ["--report-page-width" as string]: "210mm",
        ["--report-page-height" as string]: "297mm",
      }}
    >
      <BrochurePageShell brand={brand}>
        <div className="flex h-[297mm] flex-col overflow-hidden">
          <BoldPageOneSpread document={document} report={report} />
        </div>
      </BrochurePageShell>

      <BrochurePageShell brand={brand}>
        <div
          className="shrink-0 px-10 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white"
          style={{ backgroundColor: accent }}
        >
          Property highlights
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-6 px-10 py-8">
          <BrochurePhotoGrid urls={pageTwoImages.slice(0, 4)} columns={2} />
          <div className="flex flex-col justify-between gap-6">
            <BrochureBulletList items={document.copy.feature_highlights} max={6} />
            {document.copy.inspection_cta ? (
              <p
                className="rounded-sm px-4 py-3 text-center text-base font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                {document.copy.inspection_cta}
              </p>
            ) : null}
            {document.copy.disclaimer ? (
              <p className="text-[0.65rem] text-neutral-500">{document.copy.disclaimer}</p>
            ) : null}
          </div>
        </div>
      </BrochurePageShell>
    </div>
  );
}
