import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { formatNumber } from "@/lib/reports/formatters";

const headingFont = "var(--report-heading-font, var(--collateral-heading-font, inherit))";
const bodyFont = "var(--report-body-font, var(--collateral-body-font, inherit))";

/** Logo / agency mark over photography — top-left, absolute within a relative photo region. */
export function EditorialLogoOverlay({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  const logoUrl = getAgencyLogoUrl(document.agency, "dark");

  if (!logoUrl) {
    return null;
  }

  return (
    <div className="absolute left-0 top-0 z-10 p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={report.agency.name}
        className="h-10 max-w-[180px] object-contain object-left drop-shadow-md"
      />
    </div>
  );
}

/** Subtle top vignette so the logo reads on bright skies. */
export function EditorialPhotoTopScrim() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-28 bg-gradient-to-b from-black/50 to-transparent"
      aria-hidden
    />
  );
}

/** Masthead for text-only pages (no full-bleed photo at top). */
export function EditorialMasthead({
  document,
  report,
}: {
  document: SalesBrochureDocumentJson;
  report: FinalReportJson;
}) {
  const logoUrl = getAgencyLogoUrl(report.agency, "light");

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 px-10 py-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={report.agency.name}
          className="h-9 max-w-[140px] object-contain object-left"
        />
      ) : (
        <p
          className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-900"
          style={{ fontFamily: headingFont }}
        >
          {document.agency.name}
        </p>
      )}
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-neutral-500">
        Property brochure
      </p>
    </header>
  );
}

export function EditorialHeroOverlay({
  document,
  showPrice = true,
}: {
  document: SalesBrochureDocumentJson;
  showPrice?: boolean;
}) {
  const { property, copy } = document;

  return (
    <div className="absolute inset-x-0 bottom-0 z-[2] px-10 pb-9 pt-20">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
        aria-hidden
      />
      <div className="relative max-w-[92%]">
        <p
          className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/80"
          style={{ fontFamily: headingFont }}
        >
          {[property.suburb, property.state].filter(Boolean).join(", ")}
        </p>
        <h1
          className="mt-2 text-[2.15rem] font-semibold leading-[1.1] text-white"
          style={{ fontFamily: headingFont }}
        >
          {property.address}
        </h1>
        {copy.heading ? (
          <p
            className="mt-3 max-w-[36rem] text-lg font-medium leading-snug text-white/95"
            style={{ fontFamily: headingFont }}
          >
            {copy.heading}
          </p>
        ) : null}
        {showPrice && property.display_price ? (
          <p
            className="mt-4 inline-block border border-white/30 bg-white/10 px-4 py-2 text-xl font-semibold text-white backdrop-blur-sm"
            style={{ fontFamily: headingFont }}
          >
            {property.display_price}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function EditorialStatsLine({ document }: { document: SalesBrochureDocumentJson }) {
  const { property } = document;
  const items = [
    { label: "Bedrooms", value: formatNumber(property.bedrooms) },
    { label: "Bathrooms", value: formatNumber(property.bathrooms) },
    { label: "Parking", value: formatNumber(property.car_spaces) },
  ];

  if (property.land_area_sqm) {
    items.push({
      label: "Land",
      value: `${formatNumber(property.land_area_sqm)} m²`,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-neutral-200 py-3">
      {items.map((item, index) => (
        <div key={item.label} className="flex items-center gap-6">
          {index > 0 ? (
            <span className="hidden h-8 w-px bg-neutral-200 sm:block" aria-hidden />
          ) : null}
          <div>
            <p
              className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-neutral-500"
              style={{ fontFamily: headingFont }}
            >
              {item.label}
            </p>
            <p className="mt-0.5 text-lg font-semibold text-neutral-900">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EditorialNumberedList({
  items,
  title,
  max = 4,
}: {
  items: string[];
  title?: string;
  max?: number;
}) {
  if (!items.length) return null;

  return (
    <div>
      {title ? (
        <p
          className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-neutral-500"
          style={{ fontFamily: headingFont }}
        >
          {title}
        </p>
      ) : null}
      <ol className="space-y-3">
        {items.slice(0, max).map((point, index) => (
          <li key={point} className="flex gap-4">
            <span
              className="w-6 shrink-0 text-sm font-semibold tabular-nums text-neutral-400"
              style={{ fontFamily: headingFont }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className="text-[0.9rem] leading-relaxed text-neutral-800"
              style={{ fontFamily: bodyFont }}
            >
              {point}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function EditorialBlurb({ text }: { text: string }) {
  if (!text) return null;

  return (
    <p
      className="text-[1.05rem] leading-[1.75] text-neutral-800"
      style={{ fontFamily: bodyFont }}
    >
      {text}
    </p>
  );
}

export function EditorialCta({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div className="border-t border-neutral-200 pt-5">
      <p
        className="text-base font-semibold text-neutral-900"
        style={{ fontFamily: headingFont, color: "var(--report-headline-colour, inherit)" }}
      >
        {text}
      </p>
    </div>
  );
}

export function EditorialPricePanel({ document }: { document: SalesBrochureDocumentJson }) {
  if (!document.property.display_price) return null;

  return (
    <div className="border-l-2 border-neutral-900 pl-5">
      <p
        className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-neutral-500"
        style={{ fontFamily: headingFont }}
      >
        Guide price
      </p>
      <p
        className="mt-2 text-[2.25rem] font-semibold leading-none text-neutral-900"
        style={{ fontFamily: headingFont, color: "var(--report-headline-colour, inherit)" }}
      >
        {document.property.display_price}
      </p>
    </div>
  );
}

export function EditorialDisclaimer({ text }: { text: string }) {
  if (!text) return null;

  return (
    <p className="text-[0.62rem] leading-relaxed text-neutral-500">{text}</p>
  );
}
