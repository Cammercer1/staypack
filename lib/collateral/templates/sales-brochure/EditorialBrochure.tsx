import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import {
  EditorialBlurb,
  EditorialCta,
  EditorialDisclaimer,
  EditorialLogoOverlay,
  EditorialMasthead,
  EditorialNumberedList,
  EditorialPhotoTopScrim,
  EditorialPricePanel,
  EditorialStatsLine,
} from "@/lib/collateral/templates/sales-brochure/editorial/EditorialChrome";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/**
 * Editorial · 2 pages — photo spread from page top with logo; inside spread below.
 */
export function EditorialBrochure({ document }: { document: CollateralDocumentJson }) {
  if (!isSalesBrochureDocument(document)) return null;

  const { report, brand, pageOneGallery, pageTwoImages } = useBrochurePage(document);
  const hero = pageOneGallery.hero_image_url;
  const sideStack = pageOneGallery.selected_image_urls.slice(0, 2);
  const mosaic = pageTwoImages.slice(0, 6);

  return (
    <div
      className="sales-brochure-preview flex flex-col"
      style={{
        ["--report-page-width" as string]: "210mm",
        ["--report-page-height" as string]: "297mm",
      }}
    >
      {/* Page 1 — cover spread, images from top */}
      <BrochurePageShell brand={brand}>
        <div className="relative grid min-h-0 flex-1 grid-cols-[1.35fr_0.65fr] gap-[3px] bg-neutral-900">
          <EditorialPhotoTopScrim />
          <EditorialLogoOverlay document={document} report={report} />

          {hero ? (
            <div className="relative min-h-[168mm] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div />
          )}
          <div className="flex flex-col gap-[3px]">
            {sideStack.map((url) => (
              <div key={url} className="min-h-0 flex-1 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-[1.2fr_0.8fr] gap-10 px-10 py-7">
          <div className="space-y-4">
            <p
              className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: "var(--report-heading-font, inherit)" }}
            >
              {[document.property.suburb, document.property.state, document.property.postcode]
                .filter(Boolean)
                .join(", ")}
            </p>
            <h1
              className="text-[1.85rem] font-semibold leading-tight text-neutral-900"
              style={{
                fontFamily: "var(--report-heading-font, inherit)",
                color: "var(--report-headline-colour, inherit)",
              }}
            >
              {document.property.address}
            </h1>
            {document.copy.heading ? (
              <p
                className="text-lg font-medium leading-snug text-neutral-800"
                style={{ fontFamily: "var(--report-heading-font, inherit)" }}
              >
                {document.copy.heading}
              </p>
            ) : null}
            <EditorialBlurb text={document.copy.blurb} />
          </div>
          <div className="flex flex-col justify-between gap-6">
            <EditorialPricePanel document={document} />
            <EditorialStatsLine document={document} />
          </div>
        </div>
      </BrochurePageShell>

      {/* Page 2 — features (masthead; no full-bleed hero) */}
      <BrochurePageShell brand={brand}>
        <EditorialMasthead document={document} report={report} />

        {mosaic.length > 0 ? (
          <div className="relative shrink-0">
            <div className="grid grid-cols-3 gap-[3px] px-10 pt-0">
              {mosaic.slice(0, 3).map((url) => (
                <div key={url} className="h-[52mm] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-10 px-10 py-8">
          <div className="flex flex-col gap-6">
            {mosaic.length > 3 ? (
              <div className="grid flex-1 grid-cols-2 gap-[3px]">
                {mosaic.slice(3, 6).map((url) => (
                  <div key={url} className="min-h-[70mm] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col justify-between gap-8">
            <EditorialNumberedList
              items={document.copy.feature_highlights}
              title="Property highlights"
              max={6}
            />
            <div className="space-y-4">
              <EditorialCta text={document.copy.inspection_cta} />
              <EditorialDisclaimer text={document.copy.disclaimer} />
            </div>
          </div>
        </div>

        <ClassicAgentFooter report={report} />
      </BrochurePageShell>
    </div>
  );
}
