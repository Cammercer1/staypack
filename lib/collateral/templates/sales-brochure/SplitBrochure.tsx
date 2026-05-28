import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import {
  BrochureBulletList,
  BrochurePhotoGrid,
} from "@/lib/collateral/templates/sales-brochure/shared/BrochureCopyBlocks";
import { SplitSpreadLayout } from "@/lib/collateral/templates/sales-brochure/split/SplitLayout";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/** Split · 2 pages — page 1 open-home split; page 2 extra photos + highlights. */
export function SplitBrochure({ document }: { document: CollateralDocumentJson }) {
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
        <SplitSpreadLayout document={document} report={report} />
      </BrochurePageShell>

      <BrochurePageShell brand={brand}>
        <div className="flex min-h-[297mm] flex-col">
          {pageTwo.length > 0 ? (
            <BrochurePhotoGrid
              urls={pageTwo.slice(0, 6)}
              columns={3}
              className="shrink-0 [&>div]:h-[48mm]"
            />
          ) : null}

          <div className="flex flex-1 flex-col justify-between gap-8 px-10 py-8">
            <BrochureBulletList
              items={document.copy.feature_highlights}
              title="Property highlights"
              max={8}
            />
            <div className="space-y-3">
              {document.copy.disclaimer ? (
                <p className="text-[0.65rem] leading-relaxed text-neutral-500">
                  {document.copy.disclaimer}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-[0.4fr_0.6fr] border-t border-neutral-200">
            <div className="px-9 py-6" style={{ backgroundColor: "#faf9f7" }}>
              <p className="text-sm font-semibold text-neutral-900">
                {document.copy.inspection_cta}
              </p>
              <div className="mt-4 flex items-center justify-between">
                {document.agency.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={document.agency.logo_url}
                    alt={document.agency.name}
                    className="h-8 max-w-[140px] object-contain object-left"
                  />
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {document.agency.name}
                  </span>
                )}
                {document.assets.qr_code_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={document.assets.qr_code_url}
                    alt="QR"
                    className="h-12 w-12"
                  />
                ) : null}
              </div>
            </div>
            <div className="min-h-[120px] bg-neutral-100">
              {pageTwo[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pageTwo[0]}
                  alt=""
                  className="h-full min-h-[120px] w-full object-cover"
                />
              ) : null}
            </div>
          </div>
        </div>
      </BrochurePageShell>
    </div>
  );
}
