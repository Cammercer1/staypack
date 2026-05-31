import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";
import { Editable } from "@/components/collateral/sales-brochure/inline/Editable";
import { BrochureSlotImage } from "@/components/collateral/sales-brochure/inline/BrochureSlotImage";
import type { BrochureCopyFieldPath } from "@/lib/collateral/sales-brochure/editablePaths";
import { BrochureBlurbContent } from "@/lib/collateral/templates/sales-brochure/shared/BrochureBlurbContent";
import { BrochureRentalBondInline } from "@/lib/collateral/templates/sales-brochure/shared/BrochureCopyBlocks";
import { resolveBrochureAgents } from "@/lib/collateral/templates/sales-brochure/shared/resolveBrochureAgents";
import { getPropertyHighlights } from "@/lib/collateral/sales-brochure/propertyHighlights";
import {
  resolveBrochurePrice,
  resolveBrochurePriceLabel,
  type BrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { formatNumber } from "@/lib/reports/formatters";
import { isBrochureFloorPlanImage } from "@/lib/collateral/sales-brochure/brochureImageFit";
import { dedupeImageUrls } from "@/lib/listings/dedupeImageUrls";
import { cn } from "@/lib/utils";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function buildRefinedFeatures(document: BrochureDocumentJson) {
  return getPropertyHighlights(document.copy).slice(0, 6);
}

function formatSpecsLine(document: BrochureDocumentJson) {
  const { property } = document;
  const parts: string[] = [];

  if (property.bedrooms) {
    parts.push(`${formatNumber(property.bedrooms)} BEDS`);
  }
  if (property.bathrooms) {
    parts.push(`${formatNumber(property.bathrooms)} BATHS`);
  }
  if (property.land_area_sqm != null && property.land_area_sqm > 0) {
    parts.push(`${formatNumber(property.land_area_sqm)} M²`);
  } else if (property.car_spaces) {
    parts.push(`${formatNumber(property.car_spaces)} CAR`);
  }

  return parts.join("  |  ");
}

function resolveRefinedImages(document: BrochureDocumentJson) {
  const urls = document.property.page_one_image_urls.filter(Boolean);
  const hero = urls[0] ?? document.property.hero_image_url ?? "";
  const footer = urls[2] ?? urls[1] ?? hero;
  // Use a real floor plan only if one was uploaded; otherwise show a property photo.
  const floorPlan = urls.find((url) =>
    isBrochureFloorPlanImage(url, document.listing_image_meta),
  );
  const side = floorPlan ?? urls[1] ?? urls[2] ?? hero;

  return { hero, side, footer };
}

export function RefinedHeader({
  document,
}: {
  document: BrochureDocumentJson;
}) {
  const specs = formatSpecsLine(document);
  const highlight = document.agency.accent_colour || document.agency.primary_colour;
  const logoUrl = getAgencyLogoUrl(document.agency, "dark");

  return (
    <header
      className="shrink-0 px-10 pb-6 pt-9 text-white"
      style={{ backgroundColor: highlight }}
    >
      <p
        className="text-[0.65rem] font-medium uppercase tracking-[0.28em] text-white/75"
        style={{ fontFamily: headingFont }}
      >
        Introducing
      </p>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h1
            className="text-[1.75rem] font-bold uppercase leading-tight tracking-tight text-white"
            style={{ fontFamily: headingFont }}
          >
            {document.property.address}
          </h1>
          <div className="mt-2 h-px w-full max-w-[280px] bg-white/40" />
          {specs ? (
            <p
              className="mt-3 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-white/90"
              style={{ fontFamily: bodyFont }}
            >
              {specs}
            </p>
          ) : null}
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={document.agency.name}
            className="h-11 max-w-[160px] shrink-0 object-contain object-right"
          />
        ) : null}
      </div>
    </header>
  );
}

export function RefinedBody({
  document,
}: {
  document: BrochureDocumentJson;
}) {
  const features = buildRefinedFeatures(document);
  const { side } = resolveRefinedImages(document);
  const priceBoxBg = document.agency.accent_colour || "#f3f4f6";
  const priceBoxText =
    document.agency.callout_heading_colour ||
    document.agency.callout_text_colour ||
    document.agency.text_colour ||
    "#111111";

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1.05fr_0.95fr] gap-6 overflow-hidden px-10 pb-5 pt-10">
      <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
        <BrochureBlurbContent
          document={document}
          paragraphClassName="text-[0.76rem] leading-[1.65] text-neutral-700"
          headingClassName="text-[0.8rem] font-bold uppercase tracking-wide text-neutral-900"
        />

        {features.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <h2
              className="text-[1rem] font-bold uppercase tracking-wide text-neutral-900"
              style={{ fontFamily: headingFont }}
            >
              Property highlights
            </h2>
            <ul className="mt-2 space-y-1.5">
              {features.map((item, index) => (
                <li
                  key={`highlight-${index}`}
                  className="flex gap-2 text-[0.72rem] leading-snug text-neutral-700"
                  style={{ fontFamily: bodyFont }}
                >
                  <span className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-neutral-800" />
                  <Editable
                    as="span"
                    path={`copy.property_highlights.${index}`}
                    className="min-w-0"
                  >
                    {item}
                  </Editable>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {resolveBrochurePrice(document) ? (
          <div className="shrink-0 pt-1">
            <Editable
              as="p"
              path="copy.price_label"
              className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-neutral-500"
              style={{ fontFamily: headingFont }}
            >
              {resolveBrochurePriceLabel(document)}
            </Editable>
            <div
              className="mt-1.5 inline-block px-4 py-2.5"
              style={{ backgroundColor: priceBoxBg }}
            >
              <Editable
                as="p"
                path="copy.price_value"
                className="text-[1.5rem] font-bold leading-none"
                style={{ fontFamily: headingFont, color: priceBoxText }}
              >
                {resolveBrochurePrice(document)}
              </Editable>
            </div>
            <BrochureRentalBondInline document={document} compact />
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden">
        {side ? (
          <BrochureSlotImage
            url={side}
            slot={{ kind: "page_one", index: 1 }}
            className="flex min-h-0 flex-1"
            imageWrapperClassName="min-h-0 h-full flex-1"
          />
        ) : (
          <div className="min-h-0 flex-1 bg-neutral-50" />
        )}
        {document.copy.inspection_cta ? (
          <Editable
            as="p"
            path="copy.inspection_cta"
            className="mt-2 shrink-0 text-center text-[0.65rem] font-medium uppercase tracking-[0.12em] text-neutral-500"
            style={{ fontFamily: headingFont }}
          >
            {document.copy.inspection_cta}
          </Editable>
        ) : null}
      </div>
    </div>
  );
}

function RefinedGalleryCell({
  url,
  className = "",
  galleryIndex,
}: {
  url: string;
  className?: string;
  galleryIndex: number;
}) {
  return (
    <BrochureSlotImage
      url={url}
      slot={{ kind: "gallery", index: galleryIndex }}
      className={cn("min-h-0 h-full", className)}
      imageWrapperClassName="min-h-0 h-full flex-1"
    />
  );
}

/** Page 2 — mosaic gallery filling most of the page height. */
export function RefinedPageTwoGallery({ urls }: { urls: string[] }) {
  const images = dedupeImageUrls(urls).slice(0, 6);
  if (images.length === 0) return null;

  if (images.length === 1) {
    return <RefinedGalleryCell url={images[0]} className="h-full" galleryIndex={0} />;
  }

  if (images.length === 2) {
    return (
      <div className="grid h-full grid-cols-2 gap-[3px]">
        {images.map((url, index) => (
          <RefinedGalleryCell key={`${index}-${url}`} url={url} galleryIndex={index} />
        ))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div className="grid h-full grid-cols-2 gap-[3px]">
        <RefinedGalleryCell url={images[0]} className="row-span-2" galleryIndex={0} />
        <RefinedGalleryCell url={images[1]} galleryIndex={1} />
        <RefinedGalleryCell url={images[2]} galleryIndex={2} />
      </div>
    );
  }

  if (images.length === 4) {
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-[3px]">
        {images.map((url, index) => (
          <RefinedGalleryCell key={`${index}-${url}`} url={url} galleryIndex={index} />
        ))}
      </div>
    );
  }

  if (images.length === 5) {
    return (
      <div className="grid h-full grid-cols-6 grid-rows-2 gap-[3px]">
        <RefinedGalleryCell url={images[0]} className="col-span-3 row-span-2" galleryIndex={0} />
        <RefinedGalleryCell url={images[1]} className="col-span-3" galleryIndex={1} />
        <RefinedGalleryCell url={images[2]} className="col-span-3" galleryIndex={2} />
        <RefinedGalleryCell url={images[3]} className="col-span-2" galleryIndex={3} />
        <RefinedGalleryCell url={images[4]} className="col-span-2" galleryIndex={4} />
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-12 grid-rows-6 gap-[3px]">
      <RefinedGalleryCell url={images[0]} className="col-span-7 row-span-4" galleryIndex={0} />
      <RefinedGalleryCell url={images[1]} className="col-span-5 row-span-3" galleryIndex={1} />
      <RefinedGalleryCell url={images[2]} className="col-span-5 row-span-3" galleryIndex={2} />
      <RefinedGalleryCell url={images[3]} className="col-span-4 row-span-2" galleryIndex={3} />
      <RefinedGalleryCell url={images[4]} className="col-span-4 row-span-2" galleryIndex={4} />
      <RefinedGalleryCell url={images[5]} className="col-span-4 row-span-2" galleryIndex={5} />
    </div>
  );
}

export function RefinedFooterImage({ document }: { document: BrochureDocumentJson }) {
  const { footer } = resolveRefinedImages(document);

  if (!footer) return null;

  return (
    <BrochureSlotImage
      url={footer}
      slot={{ kind: "page_one", index: 2 }}
      className="h-[88mm] shrink-0"
      imageWrapperClassName="min-h-0 h-full flex-1"
    />
  );
}

export function RefinedAgentBar({
  document,
  report,
  pinnedBottom = false,
}: {
  document: BrochureDocumentJson;
  report: FinalReportJson;
  /** Page 2: flush to page bottom, no top rule. */
  pinnedBottom?: boolean;
}) {
  const agents = resolveBrochureAgents(report);
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
  const accent = document.agency.primary_colour || "#1a1a2e";
  const multiAgent = agents.length > 1;

  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-6 bg-white px-10 ${
        pinnedBottom ? "py-5" : "border-t border-neutral-200 py-4"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {agents.length > 0 ? (
          <div
            className={
              multiAgent
                ? "grid grid-cols-2 gap-x-6 gap-y-3"
                : "flex items-center gap-4"
            }
          >
            {agents.map((agent, index) => (
              <div
                key={`${agent.name}-${agent.email}-${agent.phone}-${index}`}
                className="flex items-center gap-4"
              >
                {agent.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={agent.photo_url}
                    alt={agent.name || "Agent"}
                    className="h-14 w-14 shrink-0 rounded-full object-cover object-top"
                  />
                ) : null}
                <div className="min-w-0">
                  {agent.name ? (
                    <p
                      className="text-[0.82rem] font-bold leading-tight text-neutral-900"
                      style={{ fontFamily: headingFont }}
                    >
                      {agent.name}
                    </p>
                  ) : null}
                  {agent.role_title ? (
                    <p
                      className="text-[0.7rem] text-neutral-500"
                      style={{ fontFamily: bodyFont }}
                    >
                      {agent.role_title}
                    </p>
                  ) : null}
                  {agent.phone ? (
                    <p
                      className="text-[0.72rem] text-neutral-700"
                      style={{ fontFamily: bodyFont }}
                    >
                      {agent.phone}
                    </p>
                  ) : null}
                  {agent.email ? (
                    <p
                      className="truncate text-[0.68rem] text-neutral-500"
                      style={{ fontFamily: bodyFont }}
                    >
                      {agent.email}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {/* Thin accent divider between agents and agency side */}
        <div className="mx-2 h-10 w-px shrink-0 bg-neutral-200" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p
            className="text-[0.72rem] font-semibold text-neutral-900"
            style={{ fontFamily: headingFont }}
          >
            {document.agency.name}
          </p>
          {document.agency.phone ? (
            <p className="text-[0.68rem] text-neutral-600" style={{ fontFamily: bodyFont }}>
              {document.agency.phone}
            </p>
          ) : null}
          {document.agency.website_url ? (
            <p className="text-[0.66rem] text-neutral-500" style={{ fontFamily: bodyFont }}>
              {document.agency.website_url}
            </p>
          ) : null}
        </div>
      </div>

      {/* Logo + QR */}
      <div className="flex shrink-0 items-center gap-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={document.agency.name}
            className="h-8 max-w-[140px] object-contain"
          />
        ) : (
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: accent, fontFamily: headingFont }}
          >
            {document.agency.name}
          </p>
        )}
        {document.assets.qr_code_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={document.assets.qr_code_url} alt="QR" className="h-12 w-12 shrink-0" />
        ) : null}
      </div>
    </div>
  );
}

/** Full refined single-page spread. */
export function RefinedSpread({
  document,
  report,
  showAgentBar = false,
}: {
  document: BrochureDocumentJson;
  report: FinalReportJson;
  showAgentBar?: boolean;
}) {
  return (
    <>
      <RefinedHeader document={document} />
      <RefinedBody document={document} />
      <RefinedFooterImage document={document} />
      {showAgentBar ? <RefinedAgentBar document={document} report={report} /> : null}
    </>
  );
}
