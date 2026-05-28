import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralTemplateProps, SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import { formatNumber } from "@/lib/reports/formatters";
import {
  EditorialBlurb,
  EditorialCta,
  EditorialDisclaimer,
  EditorialLogoOverlay,
  EditorialMasthead,
  EditorialNumberedList,
  EditorialPhotoTopScrim,
  EditorialPricePanel,
} from "@/lib/collateral/templates/sales-brochure/editorial/EditorialChrome";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function EditorialCoverContact({
  report,
}: {
  report: ReturnType<typeof useBrochurePage>["report"];
}) {
  const agent = report.agent;
  if (!agent.name && !agent.phone && !agent.email) return null;

  return (
    <div className="border-t border-neutral-200 pt-4">
      <p
        className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-neutral-500"
        style={{ fontFamily: headingFont }}
      >
        Contact agent
      </p>
      <div className="mt-3 flex items-center gap-3">
        {agent.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.photo_url}
            alt={agent.name || "Agent"}
            className="h-12 w-12 shrink-0 rounded-full object-cover object-top"
          />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-full bg-neutral-100" />
        )}
        <div className="min-w-0">
          {agent.name ? (
            <p
              className="text-sm font-semibold leading-tight text-neutral-900"
              style={{ fontFamily: bodyFont }}
            >
              {agent.name}
            </p>
          ) : null}
          {agent.phone ? (
            <p className="text-xs leading-snug text-neutral-700">{agent.phone}</p>
          ) : null}
          {agent.email ? (
            <p className="truncate text-xs leading-snug text-neutral-600">
              {agent.email}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EditorialCoverFacts({
  document,
}: {
  document: SalesBrochureDocumentJson;
}) {
  const { property } = document;
  const facts = [
    property.bedrooms
      ? { label: "Bedrooms", value: formatNumber(property.bedrooms) }
      : null,
    property.bathrooms
      ? { label: "Bathrooms", value: formatNumber(property.bathrooms) }
      : null,
    property.car_spaces
      ? { label: "Parking", value: formatNumber(property.car_spaces) }
      : null,
    property.land_area_sqm
      ? { label: "Land", value: `${formatNumber(property.land_area_sqm)} m²` }
      : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  if (!facts.length) return null;

  return (
    <div className="border-y border-neutral-200 py-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {facts.map((item) => (
          <div key={item.label}>
            <p
              className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-neutral-500"
              style={{ fontFamily: headingFont }}
            >
              {item.label}
            </p>
            <p
              className="mt-1 text-[1.05rem] font-semibold leading-none text-neutral-900"
              style={{ fontFamily: bodyFont }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Editorial · 2 pages — photo spread from page top with logo; inside spread below.
 */
export function EditorialBrochure({ document, pageFormat = "a4-portrait" }: CollateralTemplateProps) {
  if (!isSalesBrochureDocument(document)) return null;

  const { report, brand, pageOneGallery, pageTwoImages } = useBrochurePage(document);
  const hero = pageOneGallery.hero_image_url;
  const fmt = getCollateralPageFormat(pageFormat);
  const sideStack = pageOneGallery.selected_image_urls.slice(0, 2);

  // Build a rich left-column photo pool: page two images first, then page one leftovers
  const pageTwoPhotoPool = [
    ...pageTwoImages,
    ...document.property.page_one_image_urls
      .filter(Boolean)
      .filter((url) => !url.includes("floor-plan") && url !== hero),
    ...document.property.selected_image_urls
      .filter(Boolean)
      .filter((url) => !url.includes("floor-plan") && url !== hero),
  ].filter((url, i, arr) => arr.indexOf(url) === i);

  // Clamp to 5 photos so each one gets decent height in the column
  const pageTwoPhotos =
    pageTwoPhotoPool.length > 0
      ? pageTwoPhotoPool.slice(0, 5)
      : [hero].filter(Boolean);

  return (
    <div
      className="sales-brochure-preview flex flex-col"
      style={{
        ["--report-page-width" as string]: fmt.width,
        ["--report-page-height" as string]: fmt.height,
      }}
    >
      {/* Page 1 — cover spread, images from top */}
      <BrochurePageShell brand={brand}>
        <div className="flex flex-col overflow-hidden" style={{ height: fmt.height }}>
          <div className="relative grid h-[164mm] shrink-0 grid-cols-[1.35fr_0.65fr] gap-[3px] bg-neutral-900">
            <EditorialPhotoTopScrim />
            <EditorialLogoOverlay document={document} report={report} />

            {hero ? (
              <div className="relative min-h-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div />
            )}
            <div className="grid min-h-0 grid-rows-2 gap-[3px]">
              {sideStack.map((url) => (
                <div key={url} className="min-h-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-[1.25fr_0.75fr] gap-10 overflow-hidden px-10 py-7">
            <div className="min-h-0 space-y-3 overflow-hidden">
              <p
                className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500"
                style={{ fontFamily: headingFont }}
              >
                {[document.property.suburb, document.property.state, document.property.postcode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <h1
                className="text-[1.7rem] font-semibold leading-tight text-neutral-900"
                style={{
                  fontFamily: headingFont,
                  color: "var(--report-headline-colour, inherit)",
                }}
              >
                {document.property.address}
              </h1>
              {document.copy.heading ? (
                <p
                  className="text-[0.95rem] font-semibold leading-snug text-neutral-800"
                  style={{ fontFamily: headingFont }}
                >
                  {document.copy.heading}
                </p>
              ) : null}
              {document.copy.blurb ? (
                <p
                  className="line-clamp-6 text-[0.78rem] leading-[1.65] text-neutral-700"
                  style={{ fontFamily: bodyFont }}
                >
                  {document.copy.blurb}
                </p>
              ) : null}
            </div>
            <div className="flex min-h-0 flex-col justify-between gap-5 overflow-hidden">
              <div className="space-y-5">
                <EditorialPricePanel document={document} />
                <EditorialCoverFacts document={document} />
              </div>
              <EditorialCoverContact report={report} />
            </div>
          </div>
        </div>
      </BrochurePageShell>

      {/* Page 2 — left photo stack, right highlights + footer */}
      <BrochurePageShell brand={brand}>
        <div className="flex flex-col overflow-hidden" style={{ height: fmt.height }}>
          <EditorialMasthead document={document} report={report} />

          <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr] overflow-hidden">
            {/* Left — full-height photo stack */}
            <div className="flex min-h-0 flex-col gap-[3px] overflow-hidden">
              {pageTwoPhotos.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="min-h-0 flex-1 overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>

            {/* Right — highlights + CTA + disclaimer */}
            <div className="flex min-h-0 flex-col justify-between gap-6 overflow-hidden px-10 py-8">
              <EditorialNumberedList
                items={document.copy.feature_highlights.length
                  ? document.copy.feature_highlights
                  : document.copy.appeal_points}
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
        </div>
      </BrochurePageShell>
    </div>
  );
}
