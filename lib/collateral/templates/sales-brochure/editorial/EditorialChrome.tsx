import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";
import { Editable } from "@/components/collateral/sales-brochure/inline/Editable";
import type { BrochureCopyFieldPath } from "@/lib/collateral/sales-brochure/editablePaths";
import {
  resolveBrochurePrice,
  resolveBrochurePriceLabel,
  type SalesBrochureDocumentJson,
} from "@/lib/collateral/templates/types";
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
          <Editable
            as="p"
            path="copy.heading"
            className="mt-3 max-w-[36rem] text-lg font-medium leading-snug text-white/95"
            style={{ fontFamily: headingFont }}
          >
            {copy.heading}
          </Editable>
        ) : null}
        {showPrice && resolveBrochurePrice(document) ? (
          <p
            className="mt-4 inline-block border border-white/30 bg-white/10 px-4 py-2 text-xl font-semibold text-white backdrop-blur-sm"
            style={{ fontFamily: headingFont }}
          >
            {resolveBrochurePrice(document)}
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
  columns = 1,
}: {
  items: string[];
  title?: string;
  max?: number;
  columns?: 1 | 2;
}) {
  if (!items.length) return null;

  const visible = items.slice(0, max);

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
      <ol
        className={
          columns === 2
            ? "grid grid-cols-2 gap-x-8 gap-y-3"
            : "space-y-3"
        }
      >
        {visible.map((point, index) => (
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

/** Small-caps section eyebrow with a short rule — editorial section marker. */
export function EditorialKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-neutral-500"
        style={{ fontFamily: headingFont }}
      >
        {children}
      </span>
      <span className="h-px flex-1 bg-neutral-200" aria-hidden />
    </div>
  );
}

/** Lead paragraph with a serif drop cap — the editorial "standfirst". */
export function EditorialLede({ text }: { text: string }) {
  if (!text) return null;

  return (
    <Editable
      as="p"
      path="copy.blurb"
      className="text-[0.96rem] leading-[1.85] text-neutral-700 [&::first-letter]:float-left [&::first-letter]:mr-2.5 [&::first-letter]:mt-1 [&::first-letter]:font-semibold [&::first-letter]:text-[3.6rem] [&::first-letter]:leading-[0.72]"
      style={{
        fontFamily: bodyFont,
        ["--report-headline-colour" as string]: "inherit",
      }}
    >
      {text.trim()}
    </Editable>
  );
}

/** Refined feature index — serif numerals, hairline rule per row. */
export function EditorialFeatureIndex({
  items,
  max = 6,
  document,
}: {
  items: string[];
  max?: number;
  document?: SalesBrochureDocumentJson;
}) {
  if (!items.length) return null;

  return (
    <ol className="grid grid-cols-2 gap-x-10">
      {items.slice(0, max).map((point, index) => {
        const path: BrochureCopyFieldPath | undefined = document
          ? `copy.property_highlights.${index}`
          : undefined;

        return (
          <li key={path ?? `${point}-${index}`} className="flex gap-3 py-2.5">
            <span
              className="shrink-0 text-[0.85rem] font-semibold tabular-nums"
              style={{
                fontFamily: headingFont,
                color: "var(--report-headline-colour, inherit)",
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            {path ? (
              <Editable
                as="span"
                path={path}
                className="text-[0.82rem] leading-snug text-neutral-700"
                style={{ fontFamily: bodyFont }}
              >
                {point}
              </Editable>
            ) : (
              <span
                className="text-[0.82rem] leading-snug text-neutral-700"
                style={{ fontFamily: bodyFont }}
              >
                {point}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Vertical specifications list with hairline dividers — sidebar element. */
export function EditorialSpecSidebar({
  document,
}: {
  document: SalesBrochureDocumentJson;
}) {
  const { property } = document;
  const items = [
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

  if (!items.length) return null;

  return (
    <dl className="divide-y divide-neutral-200">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline justify-between py-2.5"
        >
          <dt
            className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-neutral-500"
            style={{ fontFamily: headingFont }}
          >
            {item.label}
          </dt>
          <dd
            className="text-[1.05rem] font-semibold leading-none text-neutral-900"
            style={{ fontFamily: headingFont }}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EditorialCta({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div className="border-t border-neutral-200 pt-5">
      <Editable
        as="p"
        path="copy.inspection_cta"
        className="text-base font-semibold text-neutral-900"
        style={{ fontFamily: headingFont, color: "var(--report-headline-colour, inherit)" }}
      >
        {text}
      </Editable>
    </div>
  );
}

export function EditorialPricePanel({ document }: { document: SalesBrochureDocumentJson }) {
  if (!resolveBrochurePrice(document)) return null;

  return (
    <div>
      <Editable
        as="p"
        path="copy.price_label"
        className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-neutral-500"
        style={{ fontFamily: headingFont }}
      >
        {resolveBrochurePriceLabel(document)}
      </Editable>
      <Editable
        as="p"
        path="copy.price_value"
        className="mt-2 text-[2.25rem] font-semibold leading-none text-neutral-900"
        style={{ fontFamily: headingFont, color: "var(--report-headline-colour, inherit)" }}
      >
        {resolveBrochurePrice(document)}
      </Editable>
    </div>
  );
}

export function EditorialDisclaimer({ text }: { text: string }) {
  if (!text) return null;

  return (
    <Editable
      as="p"
      path="copy.disclaimer"
      className="text-[0.62rem] leading-relaxed text-neutral-500"
    >
      {text}
    </Editable>
  );
}
