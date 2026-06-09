import { Editable } from "@/components/collateral/sales-brochure/inline/Editable";
import type { BrochureCopyFieldPath } from "@/lib/collateral/sales-brochure/editablePaths";
import { BrochureSlotImage } from "@/components/collateral/sales-brochure/inline/BrochureSlotImage";
import {
  resolveBrochurePrice,
  resolveBrochurePriceLabel,
  resolveBrochureBond,
  resolveBrochureBondLabel,
  type BrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { dedupeImageUrls } from "@/lib/listings/dedupeImageUrls";
import { formatNumber } from "@/lib/reports/formatters";

export function BrochureAddressBlock({
  document,
  large = false,
  inverted = false,
}: {
  document: BrochureDocumentJson;
  large?: boolean;
  inverted?: boolean;
}) {
  const { property, copy } = document;
  const textClass = inverted ? "text-white" : "text-neutral-900";
  const mutedClass = inverted ? "text-white/80" : "text-neutral-600";

  return (
    <div>
      <h2
        className={`font-semibold leading-tight ${large ? "text-[2rem]" : "text-[1.65rem]"} ${textClass}`}
        style={{ fontFamily: "var(--report-heading-font, inherit)" }}
      >
        {property.address}
      </h2>
      <p className={`mt-1 text-sm ${mutedClass}`}>
        {[property.suburb, property.state, property.postcode].filter(Boolean).join(", ")}
      </p>
      {copy.heading ? (
        <Editable
          as="p"
          path="copy.heading"
          className={`mt-3 font-semibold leading-snug ${large ? "text-xl" : "text-lg"} ${textClass}`}
          style={{ fontFamily: "var(--report-heading-font, inherit)" }}
        >
          {copy.heading}
        </Editable>
      ) : null}
    </div>
  );
}

export function BrochureStatsRow({ document }: { document: BrochureDocumentJson }) {
  const { property } = document;
  const stats = [
    { label: "Beds", value: formatNumber(property.bedrooms) },
    { label: "Bath", value: formatNumber(property.bathrooms) },
    { label: "Car", value: formatNumber(property.car_spaces) },
  ];

  if (property.land_area_sqm) {
    stats.push({ label: "m²", value: formatNumber(property.land_area_sqm) });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((item) => (
        <div
          key={item.label}
          className="min-w-[4.5rem] border border-neutral-200/80 px-3 py-2 text-center"
          style={{ backgroundColor: "var(--report-soft-highlight, #f3f4f6)" }}
        >
          <p className="text-base font-semibold">{item.value}</p>
          <p className="text-[0.625rem] font-medium uppercase tracking-wide text-neutral-500">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

export function BrochurePriceBlock({
  document,
  inverted = false,
}: {
  document: BrochureDocumentJson;
  inverted?: boolean;
}) {
  if (!resolveBrochurePrice(document) && !resolveBrochureBond(document)) return null;

  return (
    <div
      className={`p-4 ${inverted ? "bg-white/15" : ""}`}
      style={
        inverted
          ? undefined
          : { backgroundColor: "var(--report-soft-highlight, #f3f4f6)" }
      }
    >
      {resolveBrochurePrice(document) ? (
        <>
          <Editable
            as="p"
            path="copy.price_label"
            className={`text-[0.7rem] font-semibold uppercase tracking-[0.14em] ${
              inverted ? "text-white/90" : "text-neutral-600"
            }`}
          >
            {resolveBrochurePriceLabel(document)}
          </Editable>
          <Editable
            as="p"
            path="copy.price_value"
            className={`mt-2 text-[2rem] font-semibold leading-none ${inverted ? "text-white" : ""}`}
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            {resolveBrochurePrice(document)}
          </Editable>
        </>
      ) : null}
      <BrochureRentalBondInline document={document} inverted={inverted} />
    </div>
  );
}

/** Bond line for lease brochures — shown under rent/price when a bond is set. */
export function BrochureRentalBondInline({
  document,
  inverted = false,
  compact = false,
  accent,
}: {
  document: BrochureDocumentJson;
  inverted?: boolean;
  compact?: boolean;
  accent?: string;
}) {
  if (document.type !== "rental_brochure" || !resolveBrochureBond(document)) {
    return null;
  }

  const labelClass = compact
    ? inverted
      ? "text-[0.65rem] font-medium uppercase tracking-wide"
      : "text-[0.65rem] font-medium uppercase tracking-wide text-neutral-500"
    : `text-[0.7rem] font-semibold uppercase tracking-[0.14em] ${
        inverted ? "text-white/90" : "text-neutral-600"
      }`;
  const valueClass = compact
    ? inverted
      ? "text-[1rem] font-bold leading-none"
      : "mt-1 text-[1.05rem] font-bold leading-none text-neutral-900"
    : `mt-2 text-xl font-semibold leading-none ${inverted ? "text-white" : ""}`;

  return (
    <div className={compact ? "mt-2" : "mt-3 border-t border-neutral-200/60 pt-3"}>
      <Editable
        as="p"
        path="copy.bond_label"
        className={labelClass}
        style={{
          fontFamily: compact ? "var(--report-heading-font, inherit)" : undefined,
          ...(compact && inverted && accent ? { color: accent, opacity: 0.75 } : {}),
        }}
      >
        {resolveBrochureBondLabel(document)}
      </Editable>
      <Editable
        as="p"
        path="copy.bond_value"
        className={valueClass}
        style={{
          fontFamily: "var(--report-heading-font, inherit)",
          ...(accent ? { color: accent } : {}),
        }}
      >
        {resolveBrochureBond(document)}
      </Editable>
    </div>
  );
}

export function BrochureBulletList({
  items,
  title,
  max = 6,
  pathPrefix,
}: {
  items: string[];
  title?: string;
  max?: number;
  pathPrefix?: "copy.property_highlights";
}) {
  if (!items.length) return null;

  return (
    <div>
      {title ? (
        <h3
          className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-600"
          style={{ fontFamily: "var(--report-heading-font, inherit)" }}
        >
          {title}
        </h3>
      ) : null}
      <ul className={`flex flex-col gap-2.5 ${title ? "mt-4" : ""}`}>
        {items.slice(0, max).map((point, index) => (
          <li
            key={pathPrefix ? `${pathPrefix}-${index}` : point}
            className="flex gap-2.5 text-[0.85rem] leading-relaxed text-neutral-700"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
            {pathPrefix ? (
              <Editable
                as="span"
                path={`${pathPrefix}.${index}` as BrochureCopyFieldPath}
              >
                {point}
              </Editable>
            ) : (
              <span>{point}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BrochurePhotoGrid({
  urls,
  columns = 2,
  className = "",
}: {
  urls: string[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  if (!urls.length) return null;

  const gridClass =
    columns === 4 ? "grid-cols-4" : columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid gap-2 ${gridClass} ${className}`}>
      {dedupeImageUrls(urls).map((url, index) => (
        <BrochureSlotImage
          key={`${index}-${url}`}
          url={url}
          className="min-h-0 bg-neutral-100"
          imageWrapperClassName="min-h-0 aspect-[4/3] w-full"
        />
      ))}
    </div>
  );
}
