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

function buildSplitFeatureItems(document: SalesBrochureDocumentJson) {
  const { property, copy } = document;
  const items: string[] = [];

  if (property.land_area_sqm != null && property.land_area_sqm > 0) {
    items.push(`${formatNumber(property.land_area_sqm)} m²`);
  }
  if (property.bedrooms) {
    items.push(`${formatNumber(property.bedrooms)} Bedrooms`);
  }
  if (property.bathrooms) {
    items.push(`${formatNumber(property.bathrooms)} Bathrooms`);
  }
  if (property.car_spaces) {
    items.push(`${formatNumber(property.car_spaces)} Car spaces`);
  }
  if (property.property_type) {
    items.push(property.property_type);
  }

  for (const point of copy.appeal_points) {
    if (items.length >= 8) break;
    if (!items.includes(point)) items.push(point);
  }

  for (const point of copy.feature_highlights) {
    if (items.length >= 8) break;
    if (!items.includes(point)) items.push(point);
  }

  return items;
}

function ContactIcon({ type }: { type: "web" | "email" | "phone" }) {
  const paths = {
    web: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c1.5 0 3.2.6 4.4 1.6S18 8.5 18 10s-.6 3.2-1.6 4.4S13.5 18 12 18s-3.2-.6-4.4-1.6S6 11.5 6 10s.6-3.2 1.6-4.4S10.5 4 12 4z",
    email:
      "M4 6h16v12H4V6zm2 2v8h12V8l-6 4-6-4zm0-2l6 4 6-4H6z",
    phone:
      "M7 4h3l1 3h2l-1-3h2v14h-6V4zm2 2v10h2V6H9z",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 fill-current text-neutral-500"
      aria-hidden
    >
      <path d={paths[type]} />
    </svg>
  );
}

function SplitAgentBlock({
  report,
  document,
}: {
  report: FinalReportJson;
  document: SalesBrochureDocumentJson;
}) {
  const agent = report.agent;
  const accent = document.agency.accent_colour || document.agency.primary_colour;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {agent.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.photo_url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="h-16 w-16 shrink-0 rounded-full"
            style={{ backgroundColor: `${accent}33` }}
          />
        )}
        <div>
          {agent.name ? (
            <p className="text-sm font-semibold text-neutral-900">{agent.name}</p>
          ) : null}
          {agent.role_title ? (
            <p className="text-xs text-neutral-600">{agent.role_title}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 text-xs text-neutral-700">
        {document.agency.website_url ? (
          <div className="flex items-center gap-2">
            <ContactIcon type="web" />
            <span className="break-all">{document.agency.website_url}</span>
          </div>
        ) : null}
        {agent.email ? (
          <div className="flex items-center gap-2">
            <ContactIcon type="email" />
            <span className="break-all">{agent.email}</span>
          </div>
        ) : null}
        {agent.phone ? (
          <div className="flex items-center gap-2">
            <ContactIcon type="phone" />
            <span>{agent.phone}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Right column — 1 large, 2 mid, 1 wide (reference grid). */
export function SplitPhotoColumn({ document }: { document: SalesBrochureDocumentJson }) {
  const photos = resolveSplitPhotos(document);

  return (
    <div className="grid h-full min-h-[297mm] grid-rows-[1.05fr_0.55fr_0.65fr] gap-[3px] bg-white">
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
  const accent = document.agency.accent_colour || document.agency.primary_colour;
  const features = buildSplitFeatureItems(document);
  const headline = document.copy.heading?.trim() || "Open home";
  const subline = document.copy.inspection_cta?.trim() || "";

  return (
    <div
      className={`flex h-full min-h-[297mm] flex-col px-10 py-10 ${compact ? "py-8" : ""}`}
      style={{ backgroundColor: "#faf9f7" }}
    >
      <div className="flex flex-col gap-7">
        <p
          className="text-[0.7rem] font-medium tracking-wide"
          style={{ color: accent, fontFamily: headingFont }}
        >
          {document.property.address}
          {document.property.suburb
            ? `, ${[document.property.suburb, document.property.state].filter(Boolean).join(", ")}`
            : ""}
        </p>

        <div className="space-y-3">
          <h1
            className="text-[2.35rem] font-bold uppercase leading-[0.95] tracking-tight text-neutral-900"
            style={{ fontFamily: headingFont }}
          >
            {headline}
          </h1>

          {subline ? (
            <p
              className="text-xl font-semibold text-neutral-900"
              style={{ fontFamily: headingFont }}
            >
              {subline}
            </p>
          ) : null}
        </div>

        {document.copy.blurb ? (
          <p
            className={`text-[0.8rem] leading-[1.7] text-neutral-600 ${compact ? "line-clamp-5" : ""}`}
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.blurb}
          </p>
        ) : null}

        {features.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-2.5">
            {features.slice(0, 8).map((item) => (
              <li
                key={item}
                className="flex gap-2 text-[0.72rem] leading-snug text-neutral-800"
                style={{ fontFamily: bodyFont }}
              >
                <span className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-neutral-800" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {document.property.display_price ? (
          <div>
            <p
              className="text-[0.7rem] font-medium"
              style={{ color: accent, fontFamily: headingFont }}
            >
              Offered at
            </p>
            <p
              className="mt-1.5 text-[2rem] font-bold leading-none text-neutral-900"
              style={{ fontFamily: headingFont }}
            >
              {document.property.display_price}
            </p>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1" aria-hidden />

      <div className="shrink-0 pb-2">
        <SplitAgentBlock report={report} document={document} />
      </div>

      <div className="flex shrink-0 items-end justify-between gap-4 pt-5">
        {document.agency.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={document.agency.logo_url}
            alt={document.agency.name}
            className="h-9 max-w-[160px] object-contain object-left"
          />
        ) : (
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-800"
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
            className="h-14 w-14 shrink-0"
          />
        ) : null}
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
    <div className="grid min-h-[297mm] grid-cols-[0.4fr_0.6fr]">
      <SplitContentColumn document={document} report={report} />
      <SplitPhotoColumn document={document} />
    </div>
  );
}
