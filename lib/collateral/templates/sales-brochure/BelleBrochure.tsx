import { isLightColour } from "@/lib/branding/contrast";
import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { resolveBrochureBrandBand } from "@/lib/collateral/templates/sales-brochure/shared/resolveBrochureBrandBand";
import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import {
  BelleFooterBand,
  BellePageOneSpread,
} from "@/lib/collateral/templates/sales-brochure/belle/BelleLayout";
import { getBrochureGalleryPhotos } from "@/lib/collateral/templates/sales-brochure/shared/BrochureGalleryPage";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { BrochurePhotoCollage } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePhotoCollage";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

/** Belle · 2 pages — fork of Bold brochure; page 1 uses BelleLayout spread. */
export function BelleBrochure({ document, pageFormat = "a4-portrait" }: CollateralTemplateProps) {
  if (!isBrochureDocument(document)) return null;

  const { report, brand } = useBrochurePage(document);
  const fmt = getCollateralPageFormat(pageFormat);
  const band = resolveBrochureBrandBand(document.agency);
  const onLightBand = isLightColour(band.background);
  let pageTwoLogoUrl = getAgencyLogoUrl(document.agency, onLightBand ? "light" : "dark");
  let invertPageTwoLogo = !onLightBand && Boolean(pageTwoLogoUrl);
  if (!onLightBand && !pageTwoLogoUrl) {
    pageTwoLogoUrl = getAgencyLogoUrl(document.agency, "light");
    invertPageTwoLogo = Boolean(pageTwoLogoUrl);
  }
  const galleryPhotos = getBrochureGalleryPhotos(document);
  const note = document.copy.page_two_note?.trim();

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
          <BellePageOneSpread document={document} report={report} />
        </div>
      </BrochurePageShell>

      <BrochurePageShell brand={brand}>
        <div className="flex flex-col overflow-hidden" style={{ height: fmt.height }}>
          <div
            className="flex shrink-0 items-center justify-between px-8 py-4"
            style={{ backgroundColor: band.background, color: band.text }}
          >
            {pageTwoLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pageTwoLogoUrl}
                alt={document.agency.name}
                className={`h-7 max-w-[130px] object-contain${invertPageTwoLogo ? " brightness-0 invert" : ""}`}
              />
            ) : (
              <p
                className="text-sm font-bold uppercase tracking-[0.14em]"
                style={{ fontFamily: headingFont, color: band.text }}
              >
                {document.agency.name}
              </p>
            )}
            <p
              className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]"
              style={{ fontFamily: headingFont, color: band.text, opacity: 0.75 }}
            >
              {document.property.address}
            </p>
          </div>

          <BrochurePhotoCollage photos={galleryPhotos} className="min-h-0 flex-1" />

          {note ? (
            <div className="shrink-0 px-8 py-5">
              <p
                className="text-[0.78rem] leading-relaxed text-neutral-700"
                style={{ fontFamily: bodyFont }}
              >
                {note}
              </p>
            </div>
          ) : null}

          <BelleFooterBand document={document} />
        </div>
      </BrochurePageShell>
    </div>
  );
}
