import { Bath, BedDouble, Car, Ruler } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { formatNumber } from "@/lib/reports/formatters";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

function resolveGalleryPhotos(document: SalesBrochureDocumentJson) {
  const urls = document.property.page_one_image_urls.filter(Boolean);
  return {
    hero: urls[0] ?? document.property.hero_image_url ?? "",
    thumbs: [
      urls[1] ?? urls[0] ?? "",
      urls[2] ?? urls[1] ?? "",
      urls[3] ?? urls[2] ?? "",
    ],
  };
}

type GalleryAddressParts = {
  street: string | null;
  suburb: string | null;
  statePostcode: string | null;
};

/** Street lowercase @ 400; suburb + state/postcode @ 600. */
function parseGalleryAddressParts(
  document: SalesBrochureDocumentJson,
): GalleryAddressParts {
  const { property } = document;
  const suburb = property.suburb?.trim() ?? "";
  const state = property.state?.trim() ?? "";
  const postcode = property.postcode?.trim() ?? "";
  const rawAddress = property.address?.trim() ?? "";

  const statePostcode = [state ? state.toUpperCase() : "", postcode]
    .filter(Boolean)
    .join(" ");

  if (!rawAddress) {
    return {
      street: null,
      suburb: suburb ? suburb.toLowerCase() : null,
      statePostcode: statePostcode || null,
    };
  }

  if (suburb) {
    const suburbPattern = suburb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = rawAddress.match(
      new RegExp(`^(.*?)(,\\s*)?${suburbPattern}(.*)$`, "i"),
    );

    if (match) {
      const street = match[1].replace(/,\s*$/, "").trim().toLowerCase() || null;
      const afterSuburb = match[3]?.replace(/^,\s*/, "").trim() ?? "";
      return {
        street,
        suburb: suburb.toLowerCase(),
        statePostcode: afterSuburb || statePostcode || null,
      };
    }

    return {
      street: rawAddress.toLowerCase(),
      suburb: suburb.toLowerCase(),
      statePostcode: statePostcode || null,
    };
  }

  return {
    street: rawAddress.toLowerCase(),
    suburb: null,
    statePostcode: statePostcode || null,
  };
}

function GalleryAddressTitle({ document }: { document: SalesBrochureDocumentJson }) {
  const { street, suburb, statePostcode } = parseGalleryAddressParts(document);

  if (!street && !suburb && !statePostcode) {
    return null;
  }

  return (
    <p
      className="min-w-0 text-[0.95rem] text-neutral-900"
      style={{ fontFamily: bodyFont }}
    >
      {street ? <span className="font-normal">{street}</span> : null}
      {suburb ? (
        <>
          {street ? ", " : null}
          <span className="font-semibold">{suburb}</span>
        </>
      ) : null}
      {statePostcode ? (
        <>
          {street || suburb ? ", " : null}
          <span className="font-semibold">{statePostcode}</span>
        </>
      ) : null}
    </p>
  );
}

function resolveGalleryAgents(report: FinalReportJson) {
  if (report.agents?.length) {
    return report.agents.filter(
      (agent) => agent.name || agent.photo_url || agent.phone || agent.email,
    );
  }

  if (
    report.agent.name ||
    report.agent.photo_url ||
    report.agent.phone ||
    report.agent.email
  ) {
    return [report.agent];
  }

  return [];
}

function GallerySpecItem({
  icon: Icon,
  value,
}: {
  icon: LucideIcon;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-1.5 text-neutral-800">
      <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" strokeWidth={1.75} aria-hidden />
      <span
        className="text-[0.9rem] font-semibold tabular-nums"
        style={{ fontFamily: bodyFont }}
      >
        {value}
      </span>
    </div>
  );
}

export function GalleryPhotoMosaic({ document }: { document: SalesBrochureDocumentJson }) {
  const { hero, thumbs } = resolveGalleryPhotos(document);
  const logoUrl = getAgencyLogoUrl(document.agency, "light");
  const logoBg = document.agency.accent_colour || document.agency.primary_colour;

  return (
    <div className="relative flex h-[70%] min-h-0 shrink-0 flex-col gap-[6px]">
      <div className="relative min-h-0 flex-[1.5] overflow-hidden bg-neutral-200">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="h-full w-full object-cover" />
        ) : null}
        {logoUrl ? (
          <div
            className="absolute top-0 right-[5%] z-10 px-5 py-3"
            style={{ backgroundColor: logoBg }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={document.agency.name}
              className="h-8 max-w-[130px] object-contain"
            />
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-[6px]">
        {thumbs.map((url, index) => (
          <div key={`${url}-${index}`} className="min-h-0 overflow-hidden bg-neutral-200">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GalleryInfoBar({ document }: { document: SalesBrochureDocumentJson }) {
  const { property } = document;

  const specs: { id: string; icon: LucideIcon; value: string }[] = [];

  if (property.bedrooms) {
    specs.push({
      id: "bedrooms",
      icon: BedDouble,
      value: formatNumber(property.bedrooms),
    });
  }
  if (property.bathrooms) {
    specs.push({
      id: "bathrooms",
      icon: Bath,
      value: formatNumber(property.bathrooms),
    });
  }
  if (property.car_spaces) {
    specs.push({
      id: "car_spaces",
      icon: Car,
      value: formatNumber(property.car_spaces),
    });
  }
  if (property.land_area_sqm != null && property.land_area_sqm > 0) {
    specs.push({
      id: "land",
      icon: Ruler,
      value: formatNumber(property.land_area_sqm),
    });
  }

  return (
    <div className="shrink-0 px-8 pt-5">
      <div className="flex items-center justify-between gap-6 pb-3">
        <GalleryAddressTitle document={document} />
        {specs.length > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-5">
            {specs.map((spec) => (
              <GallerySpecItem key={spec.id} icon={spec.icon} value={spec.value} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="border-b border-neutral-300" />
    </div>
  );
}

function GalleryAgentContact({ agent }: { agent: FinalReportJson["agent"] }) {
  return (
    <div className="text-right text-[0.74rem] leading-snug text-neutral-700">
      {agent.name ? (
        <p
          className="text-[0.82rem] font-bold uppercase tracking-wide text-neutral-900"
          style={{ fontFamily: headingFont }}
        >
          {agent.name}
        </p>
      ) : null}
      {agent.phone ? <p className="mt-2">{agent.phone}</p> : null}
      {agent.email ? (
        <p className="mt-1 break-all text-neutral-600">{agent.email}</p>
      ) : null}
    </div>
  );
}

export function GalleryDetailsRow({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  const agent = resolveGalleryAgents(report)[0];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_0.75fr_0.85fr] gap-6 overflow-hidden px-8 py-5">
      <div className="min-w-0">
        {document.copy.blurb ? (
          <p
            className="line-clamp-6 text-[0.76rem] leading-[1.65] text-neutral-700"
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.blurb}
          </p>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {document.property.display_price ? (
          <div>
            <p
              className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-neutral-500"
              style={{ fontFamily: headingFont }}
            >
              Sale
            </p>
            <p
              className="mt-1 text-[1.05rem] font-bold text-neutral-900"
              style={{ fontFamily: headingFont }}
            >
              {document.property.display_price}
            </p>
          </div>
        ) : null}
        {document.copy.inspection_cta ? (
          <p
            className="text-[0.74rem] leading-snug text-neutral-700"
            style={{ fontFamily: bodyFont }}
          >
            {document.copy.inspection_cta}
          </p>
        ) : null}
      </div>

      {agent ? <GalleryAgentContact agent={agent} /> : <div />}
    </div>
  );
}

export function GalleryBottomBar({ document }: { document: SalesBrochureDocumentJson }) {
  const website = document.agency.website_url?.trim();

  return (
    <div className="flex shrink-0 items-center justify-between gap-6 px-8 py-4">
      {website ? (
        <p
          className="text-[0.95rem] font-medium text-neutral-700"
          style={{ fontFamily: bodyFont }}
        >
          {website.replace(/^https?:\/\//, "")}
        </p>
      ) : (
        <div />
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
  );
}

/** Gallery page 2 — plain agent text (no photo or branded block). */
export function GalleryMinimalAgentBar({
  document,
  report,
  pinnedBottom = false,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
  pinnedBottom?: boolean;
}) {
  const agent = resolveGalleryAgents(report)[0] ?? report.agent;
  const logoUrl = getAgencyLogoUrl(document.agency, "light");

  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-6 px-8 ${
        pinnedBottom ? "py-5" : "border-t border-neutral-200 py-4"
      }`}
    >
      <div
        className="min-w-0 text-[0.78rem] leading-snug text-neutral-700"
        style={{ fontFamily: bodyFont }}
      >
        {agent.name ? (
          <p className="text-[0.88rem] font-semibold text-neutral-900">{agent.name}</p>
        ) : null}
        {agent.role_title ? <p className="mt-0.5">{agent.role_title}</p> : null}
        {agent.phone ? <p className="mt-1">{agent.phone}</p> : null}
        {agent.email ? (
          <p className="mt-0.5 break-all text-neutral-600">{agent.email}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-6">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={document.agency.name}
            className="h-8 max-w-[140px] object-contain"
          />
        ) : (
          <p
            className="text-xs font-semibold uppercase tracking-wide text-neutral-800"
            style={{ fontFamily: headingFont }}
          >
            {document.agency.name}
          </p>
        )}
        {document.assets.qr_code_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={document.assets.qr_code_url} alt="QR" className="h-12 w-12" />
        ) : null}
      </div>
    </div>
  );
}

/** Gallery page 1 — hero mosaic, info bar, details, website + QR. */
export function GalleryPageOneSpread({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  return (
    <>
      <GalleryPhotoMosaic document={document} />
      <GalleryInfoBar document={document} />
      <GalleryDetailsRow document={document} report={report} />
      <GalleryBottomBar document={document} />
    </>
  );
}
