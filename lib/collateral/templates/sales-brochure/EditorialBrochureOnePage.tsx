import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralTemplateProps, SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import type { FinalReportJson } from "@/lib/types";
import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import {
  EditorialCta,
  EditorialFeatureIndex,
  EditorialHeroOverlay,
  EditorialKicker,
  EditorialLede,
  EditorialLogoOverlay,
  EditorialMasthead,
  EditorialPhotoTopScrim,
  EditorialPricePanel,
  EditorialSpecSidebar,
} from "@/lib/collateral/templates/sales-brochure/editorial/EditorialChrome";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/**
 * Editorial page-1 spread — overlay hero + drop-cap narrative column + hairline
 * specifications sidebar + agent footer. Shared by the 1-page and 2-page templates.
 */
export function EditorialPageOneSpread({
  document,
  report,
  hero,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
  hero: string;
}) {
  const highlights = [
    ...document.copy.appeal_points,
    ...document.copy.feature_highlights,
  ].filter((item, index, arr) => item && arr.indexOf(item) === index);

  return (
    <>
      {hero ? (
        <div className="relative min-h-0 flex-[1] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt="" className="h-full w-full object-cover" />
          <EditorialPhotoTopScrim />
          <EditorialLogoOverlay document={document} report={report} />
          <EditorialHeroOverlay document={document} showPrice={false} />
        </div>
      ) : (
        <EditorialMasthead document={document} report={report} />
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[1.5fr_0.9fr] gap-12 overflow-hidden px-10 py-7">
        {/* Narrative column */}
        <div className="flex min-h-0 flex-col gap-6 overflow-hidden">
          <EditorialKicker>The Residence</EditorialKicker>
          <EditorialLede text={document.copy.blurb} />
          {highlights.length > 0 ? (
            <div className="mt-auto flex flex-col gap-4">
              <EditorialKicker>At a glance</EditorialKicker>
              <EditorialFeatureIndex items={highlights} max={6} />
            </div>
          ) : null}
        </div>

        {/* Editorial sidebar */}
        <aside className="flex min-h-0 flex-col gap-7 overflow-hidden border-l border-neutral-200 pl-8">
          <div className="flex flex-col gap-3">
            <EditorialKicker>Specifications</EditorialKicker>
            <EditorialSpecSidebar document={document} />
          </div>
          <EditorialPricePanel document={document} />
          <div className="mt-auto">
            <EditorialCta text={document.copy.inspection_cta} />
          </div>
        </aside>
      </div>

      <ClassicAgentFooter report={report} />
    </>
  );
}

/**
 * Editorial · 1 page — hero flush to page top, logo over image, overlay typography below.
 */
export function EditorialBrochureOnePage({ document, pageFormat = "a4-portrait" }: CollateralTemplateProps) {
  if (!isSalesBrochureDocument(document)) return null;

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
      <BrochurePageShell brand={brand}>
        <div className="flex flex-col overflow-hidden" style={{ height: fmt.height }}>
          <EditorialPageOneSpread document={document} report={report} hero={hero} />
        </div>
      </BrochurePageShell>
    </div>
  );
}
