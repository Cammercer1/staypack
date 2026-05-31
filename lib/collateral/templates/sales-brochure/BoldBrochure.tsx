import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import {
  BoldFooterBand,
  BoldPageOneSpread,
} from "@/lib/collateral/templates/sales-brochure/bold/BoldLayout";
import { getBrochureGalleryPhotos } from "@/lib/collateral/templates/sales-brochure/shared/BrochureGalleryPage";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { BrochurePhotoCollage } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePhotoCollage";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

/**
 * Bold · 2 pages — dramatic hero cover; page 2 is a full photo collage (visual
 * feast) framed by the bold header/footer bands, with an optional note.
 */
export function BoldBrochure({ document, pageFormat = "a4-portrait" }: CollateralTemplateProps) {
  if (!isBrochureDocument(document)) return null;

  const { report, brand } = useBrochurePage(document);
  const fmt = getCollateralPageFormat(pageFormat);
  const accent = document.agency.accent_colour || document.agency.primary_colour || "#1a1a2e";
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
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
          <BoldPageOneSpread document={document} report={report} />
        </div>
      </BrochurePageShell>

      <BrochurePageShell brand={brand}>
        <div className="flex flex-col overflow-hidden" style={{ height: fmt.height }}>
          {/* Page 2 header */}
          <div
            className="flex shrink-0 items-center justify-between px-8 py-4"
            style={{ backgroundColor: accent }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={document.agency.name}
                className="h-7 max-w-[130px] object-contain brightness-0 invert"
              />
            ) : (
              <p
                className="text-sm font-bold uppercase tracking-[0.14em] text-white"
                style={{ fontFamily: headingFont }}
              >
                {document.agency.name}
              </p>
            )}
            <p
              className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/70"
              style={{ fontFamily: headingFont }}
            >
              {document.property.address}
            </p>
          </div>

          {/* Full photo collage — visual feast */}
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

          <BoldFooterBand document={document} />
        </div>
      </BrochurePageShell>
    </div>
  );
}
