import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import {
  BoldFooterBand,
  BoldPageOneSpread,
  resolveBoldPhotos,
} from "@/lib/collateral/templates/sales-brochure/bold/BoldLayout";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

/** Bold · 2 pages — dramatic hero cover; page 2 photo mosaic + highlights + footer. */
export function BoldBrochure({ document }: { document: CollateralDocumentJson }) {
  if (!isSalesBrochureDocument(document)) return null;

  const { report, brand, pageTwoImages } = useBrochurePage(document);
  const { secondary } = resolveBoldPhotos(document);
  const accent = document.agency.primary_colour || "#1a1a2e";
  const logoUrl = getAgencyLogoUrl(document.agency, "light");

  // Pool for page 2: page_two_image_urls then fall back to page_one leftovers
  const photoPool = pageTwoImages.length >= 2
    ? pageTwoImages
    : [
        ...pageTwoImages,
        ...secondary,
        ...document.property.selected_image_urls
          .filter(Boolean)
          .filter((url) => !url.includes("floor-plan")),
      ].filter((url, i, arr) => arr.indexOf(url) === i);

  const [heroTwo, ...restTwo] = photoPool;
  const bottomPhotos = restTwo.slice(0, 3);

  const highlights = [
    ...document.copy.feature_highlights,
    ...document.copy.appeal_points,
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 8);

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
        <div className="flex h-[297mm] flex-col overflow-hidden">
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

          {/* Photo mosaic */}
          {heroTwo ? (
            <div className="flex h-[140mm] shrink-0 flex-col gap-[3px]">
              <div className="min-h-0 flex-[1.7] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroTwo} alt="" className="h-full w-full object-cover" />
              </div>
              {bottomPhotos.length > 0 ? (
                <div
                  className="grid min-h-0 flex-1 gap-[3px]"
                  style={{ gridTemplateColumns: `repeat(${bottomPhotos.length}, 1fr)` }}
                >
                  {bottomPhotos.map((url, i) => (
                    <div key={`${url}-${i}`} className="min-h-0 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Highlights */}
          <div className="min-h-0 flex-1 overflow-hidden px-8 py-6">
            {highlights.length > 0 ? (
              <div>
                <p
                  className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-neutral-500"
                  style={{ fontFamily: headingFont }}
                >
                  Property highlights
                </p>
                <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2">
                  {highlights.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-[0.72rem] leading-snug text-neutral-800"
                      style={{ fontFamily: bodyFont }}
                    >
                      <span
                        className="mt-[0.3rem] h-[5px] w-[5px] shrink-0 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {document.copy.disclaimer ? (
              <p
                className="mt-4 text-[0.56rem] leading-relaxed text-neutral-400"
                style={{ fontFamily: bodyFont }}
              >
                {document.copy.disclaimer}
              </p>
            ) : null}
          </div>

          <BoldFooterBand document={document} />
        </div>
      </BrochurePageShell>
    </div>
  );
}
