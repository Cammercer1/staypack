import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";
import { Editable } from "@/components/collateral/sales-brochure/inline/Editable";
import { BrochureSlotImage } from "@/components/collateral/sales-brochure/inline/BrochureSlotImage";
import {
  getBlurbBlocks,
  sliceBlurbBlocksByParagraphs,
} from "@/lib/collateral/sales-brochure/blurbBlocks";
import { BrochureBlurbContent } from "@/lib/collateral/templates/sales-brochure/shared/BrochureBlurbContent";
import { BrochureRentalBondInline } from "@/lib/collateral/templates/sales-brochure/shared/BrochureCopyBlocks";
import { resolveBrochureAgents } from "@/lib/collateral/templates/sales-brochure/shared/resolveBrochureAgents";
import { getPropertyHighlights } from "@/lib/collateral/sales-brochure/propertyHighlights";
import {
  resolveBrochurePrice,
  resolveBrochurePriceLabel,
  resolveBrochureBond,
  type BrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { formatNumber } from "@/lib/reports/formatters";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function resolveSplitPhotos(document: BrochureDocumentJson) {
  const urls = document.property.page_one_image_urls.filter(Boolean);
  return {
    top: urls[0] ?? document.property.hero_image_url ?? "",
    middleLeft: urls[1] ?? urls[0] ?? "",
    middleRight: urls[2] ?? urls[1] ?? "",
    bottom: urls[3] ?? urls[2] ?? urls[0] ?? "",
  };
}

/** Property stats only — page 1 sidebar should not dump all appeal bullets. */
function buildSplitPageOneFeatures(document: BrochureDocumentJson) {
  const { property } = document;
  const items: string[] = [];

  if (property.bedrooms) {
    items.push(`${formatNumber(property.bedrooms)} Bedrooms`);
  }
  if (property.bathrooms) {
    items.push(`${formatNumber(property.bathrooms)} Bathrooms`);
  }
  if (property.car_spaces) {
    items.push(`${formatNumber(property.car_spaces)} Car spaces`);
  }
  if (property.land_area_sqm != null && property.land_area_sqm > 0) {
    items.push(`${formatNumber(property.land_area_sqm)} m²`);
  }
  if (property.property_type) {
    items.push(property.property_type);
  }

  return items;
}

function headlineIncludesAddress(heading: string, address: string) {
  const h = heading.trim().toLowerCase();
  const a = address.trim().toLowerCase();
  if (!h || !a) return false;
  return h.includes(a) || a.includes(h);
}

function formatAddressLine(document: BrochureDocumentJson) {
  const parts = [
    document.property.address,
    [document.property.suburb, document.property.state, document.property.postcode]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  return parts.join(", ");
}

function SplitAgentBlock({
  agent,
  document,
  compact = false,
}: {
  agent: FinalReportJson["agent"];
  document: BrochureDocumentJson;
  compact?: boolean;
}) {
  const accent = document.agency.accent_colour || document.agency.primary_colour;
  const avatarSize = compact ? 48 : 64;

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <div className="flex items-center gap-3">
        {agent.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.photo_url}
            alt=""
            className="shrink-0 rounded-full object-cover"
            style={{ width: avatarSize, height: avatarSize }}
          />
        ) : (
          <div
            className="shrink-0 rounded-full"
            style={{
              width: avatarSize,
              height: avatarSize,
              backgroundColor: `${accent}33`,
            }}
          />
        )}
        <div className="min-w-0">
          {agent.name ? (
            <p className="text-sm font-semibold leading-tight text-neutral-900">{agent.name}</p>
          ) : null}
          {agent.role_title ? (
            <p className="text-xs leading-snug text-neutral-600">{agent.role_title}</p>
          ) : null}
          {compact && agent.phone ? (
            <p className="text-xs leading-snug text-neutral-700">{agent.phone}</p>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <div className="space-y-2 text-xs text-neutral-700">
          {document.agency.website_url ? (
            <p className="break-all">{document.agency.website_url}</p>
          ) : null}
          {agent.email ? <p className="break-all">{agent.email}</p> : null}
          {agent.phone ? <p>{agent.phone}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Right column — 1 large, 2 mid, 1 wide (reference grid). */
export function SplitPhotoColumn({ document }: { document: BrochureDocumentJson }) {
  const photos = resolveSplitPhotos(document);

  return (
    <div className="grid h-full grid-rows-[1.05fr_0.55fr_0.65fr] gap-[3px] bg-white">
      {photos.top ? (
        <BrochureSlotImage
          url={photos.top}
          slot={{ kind: "page_one", index: 0 }}
          className="min-h-0 h-full"
          imageWrapperClassName="min-h-0 h-full flex-1"
        />
      ) : (
        <div className="bg-neutral-200" />
      )}
      <div className="grid min-h-0 grid-cols-2 gap-[3px]">
        {[photos.middleLeft, photos.middleRight].map((url, index) =>
          url ? (
            <BrochureSlotImage
              key={`${url}-${index}`}
              url={url}
              slot={{ kind: "page_one", index: index + 1 }}
              className="min-h-0 h-full"
              imageWrapperClassName="min-h-0 h-full flex-1"
            />
          ) : (
            <div key={index} className="bg-neutral-200" />
          ),
        )}
      </div>
      {photos.bottom ? (
        <BrochureSlotImage
          url={photos.bottom}
          slot={{ kind: "page_one", index: 3 }}
          className="min-h-0 h-full"
          imageWrapperClassName="min-h-0 h-full flex-1"
        />
      ) : (
        <div className="bg-neutral-200" />
      )}
    </div>
  );
}

/** Left column — copy, features, price, agent, logo (reference). */
export function SplitContentColumn({
  document,
  report,
  compact = false,
}: {
  document: BrochureDocumentJson;
  report: FinalReportJson;
  compact?: boolean;
}) {
  const accent = document.agency.primary_colour || document.agency.accent_colour || "#1f2937";
  const features = buildSplitPageOneFeatures(document);
  const headline = document.copy.heading?.trim() || "Open home";
  const showAddressLine = !headlineIncludesAddress(headline, document.property.address);
  const subline = document.copy.inspection_cta?.trim() || "";
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
  const allBlurbBlocks = getBlurbBlocks(document.copy);
  const paragraphCount = allBlurbBlocks.filter((block) => block.type === "paragraph").length;
  const maxParagraphs = compact ? 2 : Math.max(paragraphCount, 3);
  const { visible: blurbPreviewBlocks } = sliceBlurbBlocksByParagraphs(
    allBlurbBlocks,
    maxParagraphs,
  );
  const blurbLineClampClass =
    paragraphCount >= 3 ? undefined : compact ? "line-clamp-4" : "line-clamp-5";

  return (
    <div
      className="flex h-full flex-col overflow-hidden px-7 py-8"
      style={{ backgroundColor: "#faf9f7" }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {showAddressLine ? (
          <p
            className="text-[0.68rem] font-medium leading-snug text-neutral-600"
            style={{ fontFamily: bodyFont }}
          >
            {formatAddressLine(document)}
          </p>
        ) : null}

        <Editable
          as="h1"
          path="copy.heading"
          className="line-clamp-4 text-[1.2rem] font-bold leading-[1.15] text-neutral-900"
          style={{ fontFamily: headingFont }}
        >
          {headline}
        </Editable>

        {subline ? (
          <Editable
            as="p"
            path="copy.inspection_cta"
            className="line-clamp-2 text-[0.78rem] font-semibold leading-snug text-neutral-800"
            style={{ fontFamily: headingFont }}
          >
            {subline}
          </Editable>
        ) : null}

        <BrochureBlurbContent
          document={document}
          blocks={blurbPreviewBlocks}
          className={blurbLineClampClass}
          paragraphClassName="text-[0.72rem] leading-[1.65] text-neutral-600"
          headingClassName="text-[0.7rem] font-bold uppercase tracking-wide text-neutral-800"
        />

        {features.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {features.slice(0, 6).map((item) => (
              <li
                key={item}
                className="flex gap-1.5 text-[0.68rem] leading-snug text-neutral-800"
                style={{ fontFamily: bodyFont }}
              >
                <span className="mt-[0.3rem] h-1 w-1 shrink-0 rounded-full bg-neutral-800" />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-auto shrink-0">
        {(resolveBrochurePrice(document) || resolveBrochureBond(document)) ? (
          <div className="mb-3">
            {resolveBrochurePrice(document) ? (
              <>
                <Editable
                  as="p"
                  path="copy.price_label"
                  className="text-[0.65rem] font-medium uppercase tracking-wide text-neutral-500"
                  style={{ fontFamily: headingFont }}
                >
                  {resolveBrochurePriceLabel(document)}
                </Editable>
                <Editable
                  as="p"
                  path="copy.price_value"
                  className="mt-1 text-[1.45rem] font-bold leading-none text-neutral-900"
                  style={{ fontFamily: headingFont, color: accent }}
                >
                  {resolveBrochurePrice(document)}
                </Editable>
              </>
            ) : null}
            <BrochureRentalBondInline document={document} compact accent={accent} />
          </div>
        ) : null}

        <div className="space-y-3 border-t border-neutral-200/80 pt-4">
          <div className="space-y-4">
            {resolveBrochureAgents(report).map((agent, index) => (
              <SplitAgentBlock
                key={`${agent.name}-${agent.email}-${agent.phone}-${index}`}
                agent={agent}
                document={document}
                compact
              />
            ))}
          </div>

        <div className="flex items-end justify-between gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={document.agency.name}
              className="h-8 max-w-[130px] object-contain object-left"
            />
          ) : (
            <p
              className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-neutral-800"
              style={{ fontFamily: headingFont }}
            >
              {document.agency.name}
            </p>
          )}
          {document.assets.qr_code_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={document.assets.qr_code_url}
              alt="QR code"
              className="h-11 w-11 shrink-0"
            />
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}

/** Full split spread: content left, photos right. */
export function SplitSpreadLayout({
  document,
  report,
}: {
  document: BrochureDocumentJson;
  report: FinalReportJson;
}) {
  return (
    <div className="grid grid-cols-[0.42fr_0.58fr] overflow-hidden" style={{ height: "var(--report-page-height, 297mm)" }}>
      <SplitContentColumn document={document} report={report} />
      <SplitPhotoColumn document={document} />
    </div>
  );
}

/** Page 2 feature list — property highlights plus page-one stats when needed. */
export function buildSplitFeatureItems(document: BrochureDocumentJson) {
  const { property, copy } = document;
  const items = buildSplitPageOneFeatures(document);

  for (const point of getPropertyHighlights(copy)) {
    if (items.length >= 8) break;
    if (!items.includes(point)) items.push(point);
  }

  if (items.length === 0 && property.property_type) {
    items.push(property.property_type);
  }

  return items;
}
