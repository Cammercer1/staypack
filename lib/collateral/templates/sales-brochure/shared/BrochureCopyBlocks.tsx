import { Editable } from "@/components/collateral/sales-brochure/inline/Editable";
import type { BrochureCopyFieldPath } from "@/lib/collateral/sales-brochure/editablePaths";
import {
  resolveBrochurePrice,
  resolveBrochurePriceLabel,
  type SalesBrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { formatNumber } from "@/lib/reports/formatters";

export function BrochureAddressBlock({
  document,
  large = false,
  inverted = false,
}: {
  document: SalesBrochureDocumentJson;
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

export function BrochureStatsRow({ document }: { document: SalesBrochureDocumentJson }) {
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
  document: SalesBrochureDocumentJson;
  inverted?: boolean;
}) {
  if (!resolveBrochurePrice(document)) return null;

  return (
    <div
      className={`p-4 ${inverted ? "bg-white/15" : ""}`}
      style={
        inverted
          ? undefined
          : { backgroundColor: "var(--report-soft-highlight, #f3f4f6)" }
      }
    >
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
      {urls.map((url) => (
        <div key={url} className="min-h-0 overflow-hidden bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
