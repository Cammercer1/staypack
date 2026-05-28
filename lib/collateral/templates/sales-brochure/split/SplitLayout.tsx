import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { formatNumber } from "@/lib/reports/formatters";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function resolveSplitPhotos(document: SalesBrochureDocumentJson) {
  const urls = document.property.page_one_image_urls.filter(Boolean);
  return {
    top: urls[0] ?? document.property.hero_image_url ?? "",
    middleLeft: urls[1] ?? urls[0] ?? "",
    middleRight: urls[2] ?? urls[1] ?? "",
    bottom: urls[3] ?? urls[2] ?? urls[0] ?? "",
  };
}

/** Property stats only — page 1 sidebar should not dump all appeal bullets. */
function buildSplitPageOneFeatures(document: SalesBrochureDocumentJson) {
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

function formatAddressLine(document: SalesBrochureDocumentJson) {
  const parts = [
    document.property.address,
    [document.property.suburb, document.property.state, document.property.postcode]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  return parts.join(", ");
}

function SplitAgentBlock({
  report,
  document,
  compact = false,
}: {
  report: FinalReportJson;
  document: SalesBrochureDocumentJson;
  compact?: boolean;
}) {
  const agent = report.agent;
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
export function SplitPhotoColumn({ document }: { document: SalesBrochureDocumentJson }) {
  const photos = resolveSplitPhotos(document);

  return (
    <div className="grid h-full grid-rows-[1.05fr_0.55fr_0.65fr] gap-[3px] bg-white">
      {photos.top ? (
        <div className="min-h-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos.top} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="bg-neutral-200" />
      )}
      <div className="grid min-h-0 grid-cols-2 gap-[3px]">
        {[photos.middleLeft, photos.middleRight].map((url, index) =>
          url ? (
            <div key={`${url}-${index}`} className="min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div key={index} className="bg-neutral-200" />
          ),
        )}
      </div>
      {photos.bottom ? (
        <div className="min-h-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos.bottom} alt="" className="h-full w-full object-cover" />
        </div>
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
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
  compact?: boolean;
}) {
  const accent = document.agency.primary_colour || document.agency.accent_colour || "#1f2937";
  const features = buildSplitPageOneFeatures(document);
  const headline = document.copy.heading?.trim() || "Open home";
  const showAddressLine = !headlineIncludesAddress(headline, document.property.address);
  const subline = document.copy.inspection_cta?.trim() || "";
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
  const blurbParagraphs = document.copy.blurb.split(/\n\n+/).filter(Boolean);
  const blurbPreview = blurbParagraphs.slice(0, compact ? 2 : 3).join("\n\n");

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

        <h1
          className="line-clamp-4 text-[1.2rem] font-bold leading-[1.15] text-neutral-900"
          style={{ fontFamily: headingFont }}
        >
          {headline}
        </h1>

        {subline ? (
          <p
            className="line-clamp-2 text-[0.78rem] font-semibold leading-snug text-neutral-800"
            style={{ fontFamily: headingFont }}
          >
            {subline}
          </p>
        ) : null}

        {blurbPreview ? (
          <p
            className={`line-clamp-5 text-[0.72rem] leading-[1.65] text-neutral-600 ${
              compact ? "line-clamp-4" : ""
            }`}
            style={{ fontFamily: bodyFont }}
          >
            {blurbPreview}
          </p>
        ) : null}

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
        {document.property.display_price ? (
          <div className="mb-3">
            <p
              className="text-[0.65rem] font-medium uppercase tracking-wide text-neutral-500"
              style={{ fontFamily: headingFont }}
            >
              Offered at
            </p>
            <p
              className="mt-1 text-[1.45rem] font-bold leading-none text-neutral-900"
              style={{ fontFamily: headingFont, color: accent }}
            >
              {document.property.display_price}
            </p>
          </div>
        ) : null}

        <div className="space-y-3 border-t border-neutral-200/80 pt-4">
          <SplitAgentBlock report={report} document={document} compact />

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
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  return (
    <div className="grid h-[297mm] grid-cols-[0.42fr_0.58fr] overflow-hidden">
      <SplitContentColumn document={document} report={report} />
      <SplitPhotoColumn document={document} />
    </div>
  );
}

/** Page 2 feature list — includes appeal points and highlights. */
export function buildSplitFeatureItems(document: SalesBrochureDocumentJson) {
  const { property, copy } = document;
  const items = buildSplitPageOneFeatures(document);

  for (const point of copy.appeal_points) {
    if (items.length >= 8) break;
    if (!items.includes(point)) items.push(point);
  }

  for (const point of copy.feature_highlights) {
    if (items.length >= 8) break;
    if (!items.includes(point)) items.push(point);
  }

  if (items.length === 0 && property.property_type) {
    items.push(property.property_type);
  }

  return items;
}
