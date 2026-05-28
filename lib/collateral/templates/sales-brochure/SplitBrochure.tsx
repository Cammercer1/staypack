import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import {
  SplitSpreadLayout,
  buildSplitFeatureItems,
} from "@/lib/collateral/templates/sales-brochure/split/SplitLayout";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function SplitPageTwoPhotoMosaic({ urls }: { urls: string[] }) {
  const images = [...urls].filter(Boolean);
  // Pad with repeats if needed
  while (images.length < 4 && images.length > 0) {
    images.push(images[images.length % images.length]!);
  }
  if (!images.length) return null;

  const [hero, ...rest] = images;
  const row = rest.slice(0, 3);

  return (
    <div className="flex h-full flex-col gap-[3px]">
      {/* Hero row */}
      <div className="min-h-0 flex-[1.6] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero} alt="" className="h-full w-full object-cover" />
      </div>

      {/* Thumbnail row */}
      {row.length > 0 ? (
        <div
          className={`grid min-h-0 flex-1 gap-[3px]`}
          style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}
        >
          {row.map((url, i) => (
            <div key={`${url}-${i}`} className="min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Split · 2 pages — page 1 open-home split; page 2 photo mosaic + highlights + footer. */
export function SplitBrochure({ document }: { document: CollateralDocumentJson }) {
  if (!isSalesBrochureDocument(document)) return null;

  const { report, brand, pageTwoImages } = useBrochurePage(document);
  const features = buildSplitFeatureItems(document);
  const agent = report.agent;
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
  const accent = document.agency.primary_colour || "#1f2937";

  // Use page_two_image_urls, fall back to page_one_image_urls[1+]
  const photoPool = pageTwoImages.length >= 2
    ? pageTwoImages
    : document.property.page_one_image_urls.slice(1).filter(Boolean);

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
        <div className="flex h-[297mm] flex-col overflow-hidden">

          {/* Photo mosaic — 52% of page */}
          <div className="h-[155mm] shrink-0 overflow-hidden">
            <SplitPageTwoPhotoMosaic urls={photoPool.slice(0, 4)} />
          </div>

          {/* Highlights — fills remaining space */}
          <div className="min-h-0 flex-1 overflow-hidden px-10 py-7">
            {features.length > 0 ? (
              <div>
                <p
                  className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-neutral-500"
                  style={{ fontFamily: headingFont }}
                >
                  Property highlights
                </p>
                <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2.5">
                  {features.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-[0.74rem] leading-snug text-neutral-800"
                      style={{ fontFamily: bodyFont }}
                    >
                      <span className="mt-[0.32rem] h-[5px] w-[5px] shrink-0 rounded-full bg-neutral-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Footer band */}
          <div
            className="shrink-0 px-10 py-5"
            style={{ backgroundColor: accent }}
          >
            <div className="flex items-center justify-between gap-6">
              {/* Agent */}
              <div className="flex items-center gap-3">
                {agent.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={agent.photo_url}
                    alt={agent.name || "Agent"}
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-full bg-white/20" />
                )}
                <div className="space-y-0.5">
                  {agent.name ? (
                    <p
                      className="text-sm font-semibold text-white"
                      style={{ fontFamily: bodyFont }}
                    >
                      {agent.name}
                    </p>
                  ) : null}
                  {agent.role_title ? (
                    <p className="text-[0.7rem] text-white/80" style={{ fontFamily: bodyFont }}>
                      {agent.role_title}
                    </p>
                  ) : null}
                  {agent.phone ? (
                    <p className="text-[0.7rem] text-white/80" style={{ fontFamily: bodyFont }}>
                      {agent.phone}
                    </p>
                  ) : null}
                  {agent.email ? (
                    <p className="text-[0.7rem] text-white/80" style={{ fontFamily: bodyFont }}>
                      {agent.email}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Logo + QR */}
              <div className="flex items-center gap-5">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={document.agency.name}
                    className="h-8 max-w-[120px] object-contain brightness-0 invert"
                  />
                ) : (
                  <p
                    className="text-sm font-bold text-white"
                    style={{ fontFamily: headingFont }}
                  >
                    {document.agency.name}
                  </p>
                )}
                {document.assets.qr_code_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={document.assets.qr_code_url}
                    alt="QR"
                    className="h-12 w-12 shrink-0 rounded bg-white p-1"
                  />
                ) : null}
              </div>
            </div>

            {document.copy.disclaimer ? (
              <p
                className="mt-3 text-[0.56rem] leading-relaxed text-white/50"
                style={{ fontFamily: bodyFont }}
              >
                {document.copy.disclaimer}
              </p>
            ) : null}
          </div>

        </div>
      </BrochurePageShell>
    </div>
  );
}
