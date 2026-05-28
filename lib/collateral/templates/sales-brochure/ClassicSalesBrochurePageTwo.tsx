import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { getReportBrandColours } from "@/lib/reports/brandColours";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function ClassicPageTwoPhotoMosaic({ urls }: { urls: string[] }) {
  const images = urls.filter(Boolean).slice(0, 6);
  if (!images.length) return null;

  if (images.length === 1) {
    return (
      <div className="h-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div className="grid h-full grid-cols-2 gap-[3px]">
        {images.map((url, i) => (
          <div key={`${url}-${i}`} className="min-h-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div className="grid h-full grid-cols-2 gap-[3px]">
        <div className="min-h-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="grid min-h-0 grid-rows-2 gap-[3px]">
          {images.slice(1).map((url, i) => (
            <div key={`${url}-${i}`} className="min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4–6 images: hero top row (col-span-2), rest below
  const [hero, ...rest] = images;
  const bottomCount = rest.length;

  return (
    <div className="flex h-full flex-col gap-[3px]">
      <div className="min-h-0 flex-[1.4] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero} alt="" className="h-full w-full object-cover" />
      </div>
      <div
        className="grid min-h-0 flex-1 gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${bottomCount}, 1fr)` }}
      >
        {rest.map((url, i) => (
          <div key={`${url}-${i}`} className="min-h-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

type Props = {
  document: SalesBrochureDocumentJson;
};

export function ClassicSalesBrochurePageTwo({ document }: Props) {
  const report = salesBrochureToReportShape(document);
  const brand = getReportBrandColours(report.agency);

  // Use page_two_image_urls, fall back to page_one images 1+ if needed
  const rawPageTwo = document.property.page_two_image_urls.filter(Boolean);
  const images =
    rawPageTwo.length >= 2
      ? rawPageTwo
      : document.property.page_one_image_urls.slice(1).filter(Boolean);

  const highlights = [
    ...document.copy.feature_highlights,
    ...document.copy.appeal_points,
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 8);

  const photoHeight = images.length > 0 ? "h-[150mm]" : "h-0";

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        width: "var(--report-page-width, 210mm)",
        height: "var(--report-page-height, 297mm)",
      }}
    >
      {/* Full-bleed photo mosaic */}
      {images.length > 0 ? (
        <div className={`${photoHeight} shrink-0 overflow-hidden`}>
          <ClassicPageTwoPhotoMosaic urls={images} />
        </div>
      ) : null}

      {/* Highlights + CTA */}
      <div className="min-h-0 flex-1 overflow-hidden px-10 py-7">
        {highlights.length > 0 ? (
          <div>
            <p
              className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-neutral-500"
              style={{ fontFamily: headingFont }}
            >
              Property highlights
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2.5">
              {highlights.map((point) => (
                <li
                  key={point}
                  className="flex gap-2 text-[0.74rem] leading-snug text-neutral-800"
                  style={{ fontFamily: bodyFont }}
                >
                  <span
                    className="mt-[0.32rem] h-[5px] w-[5px] shrink-0 rounded-full bg-neutral-400"
                    aria-hidden
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {document.copy.inspection_cta ? (
          <p
            className="mt-5 text-[0.8rem] font-medium leading-snug text-neutral-700"
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.inspection_cta}
          </p>
        ) : null}

        {document.copy.disclaimer ? (
          <p
            className="mt-4 text-[0.58rem] leading-relaxed text-neutral-400"
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.disclaimer}
          </p>
        ) : null}
      </div>

      <ClassicAgentFooter report={report} />
    </section>
  );
}
