import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralDocumentJson, CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import {
  EditorialBlurb,
  EditorialCta,
  EditorialHeroOverlay,
  EditorialLogoOverlay,
  EditorialMasthead,
  EditorialNumberedList,
  EditorialPhotoTopScrim,
  EditorialStatsLine,
} from "@/lib/collateral/templates/sales-brochure/editorial/EditorialChrome";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

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
        {hero ? (
          <div className="relative min-h-0 flex-[1.05] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero} alt="" className="h-full w-full object-cover" />
            <EditorialPhotoTopScrim />
            <EditorialLogoOverlay document={document} report={report} />
            <EditorialHeroOverlay document={document} />
          </div>
        ) : (
          <EditorialMasthead document={document} report={report} />
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-10 py-5">
          <EditorialBlurb text={document.copy.blurb} />
          <EditorialStatsLine document={document} />
          <EditorialNumberedList
            items={document.copy.appeal_points}
            title="At a glance"
            max={3}
          />
          <EditorialCta text={document.copy.inspection_cta} />
        </div>

        <ClassicAgentFooter report={report} />
      </BrochurePageShell>
    </div>
  );
}
