"use client";

import { Bath, BedDouble, Car, Ruler } from "lucide-react";
import { Editable } from "@/components/collateral/sales-brochure/inline/Editable";
import { useEditableContext } from "@/components/collateral/sales-brochure/inline/EditableContext";
import type { LucideIcon } from "lucide-react";
import { hasBlurbContent } from "@/lib/collateral/sales-brochure/blurbBlocks";
import { BrochureBlurbContent } from "@/lib/collateral/templates/sales-brochure/shared/BrochureBlurbContent";
import { BrochureRentalBondInline } from "@/lib/collateral/templates/sales-brochure/shared/BrochureCopyBlocks";
import { getPropertyHighlights } from "@/lib/collateral/sales-brochure/propertyHighlights";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import { ClassicBrochureMetricsStack } from "@/lib/collateral/templates/sales-brochure/shared/ClassicBrochureMetricsStack";
import { formatNumber } from "@/lib/reports/formatters";
import {
  resolveReportPageVariant,
  type ReportPageVariant,
} from "@/lib/reports/templates/shared/reportPageVariant";
import type { FinalReportJson } from "@/lib/types";

type Props = {
  document: BrochureDocumentJson;
  report?: FinalReportJson;
  reportVariant?: ReportPageVariant;
  /** Tighter layout for single-page brochure. */
  compact?: boolean;
};

export function SalesBrochurePropertySection({
  document,
  report,
  reportVariant,
  compact = false,
}: Props) {
  const { editable } = useEditableContext();
  const { property, copy } = document;
  const propertyStats: {
    id: string;
    icon: LucideIcon;
    value: string;
    label: string;
  }[] = [
    {
      id: "bedrooms",
      icon: BedDouble,
      value: formatNumber(property.bedrooms),
      label: "Beds",
    },
    {
      id: "bathrooms",
      icon: Bath,
      value: formatNumber(property.bathrooms),
      label: "Bath",
    },
    {
      id: "car_spaces",
      icon: Car,
      value: formatNumber(property.car_spaces),
      label: "Car",
    },
  ];

  if (property.land_area_sqm != null && property.land_area_sqm > 0) {
    propertyStats.push({
      id: "land",
      icon: Ruler,
      value: formatNumber(property.land_area_sqm),
      label: "m²",
    });
  }

  const highlights = getPropertyHighlights(copy).slice(0, 4);
  const showTwoColumnBody = Boolean(
    editable || hasBlurbContent(copy) || highlights.length,
  );

  return (
    <div className="shrink-0 px-10">
      {/* ── Header row: address left, stats + price right ── */}
      <div className="grid grid-cols-[1fr_auto] items-start gap-x-12 border-b border-neutral-200 py-6">
        {/* Address block */}
        <div className="min-w-0">
          <h2
            className="text-[1.65rem] font-semibold leading-tight"
            style={{
              fontFamily: "var(--report-heading-font, var(--collateral-heading-font, inherit))",
              color: "var(--report-headline-colour, inherit)",
            }}
          >
            {property.address}
          </h2>
          {property.suburb ? (
            <p className="mt-1 text-sm text-neutral-500">
              {[property.suburb, property.state, property.postcode]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : null}
          {copy.heading ? (
            <Editable
              as="p"
              path="copy.heading"
              className="mt-3 text-base font-semibold leading-snug"
              style={{
                fontFamily: "var(--report-heading-font, var(--collateral-heading-font, inherit))",
                color: "var(--report-text-colour, inherit)",
              }}
            >
              {copy.heading}
            </Editable>
          ) : null}
        </div>

        {/* Stats + price */}
        <div className="flex shrink-0 flex-col items-start gap-5">
          <div
            className={`grid gap-x-7 gap-y-2 ${
              propertyStats.length >= 4 ? "grid-cols-4" : "grid-cols-3"
            }`}
          >
            {propertyStats.map((item) => (
              <ClassicStat
                key={item.id}
                icon={item.icon}
                value={item.value}
                label={item.label}
              />
            ))}
          </div>

          {report ? (
            <div className="w-full">
              <ClassicBrochureMetricsStack
                report={report}
                document={document}
                reportVariant={reportVariant}
              />
              <BrochureRentalBondInline document={document} compact />
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Body row: blurb left, bullets right ── */}
      {showTwoColumnBody ? (
        <div
          className={`grid items-start gap-x-10 pt-6 pb-7 ${
            highlights.length > 0 ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          <BrochureBlurbContent
            document={document}
            paragraphClassName="min-w-0 text-[0.9rem] leading-[1.75] text-neutral-700"
            headingClassName="text-sm font-semibold text-neutral-900"
          />

          {highlights.length ? (
            <ul className={`min-w-0 flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
              {highlights.map((point, index) => (
                <li
                  key={`highlight-${index}`}
                  className="flex gap-2.5 text-[0.82rem] leading-snug text-neutral-700"
                >
                  <span
                    className="mt-[0.3rem] h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400"
                    aria-hidden
                  />
                  <Editable
                    as="span"
                    path={`copy.property_highlights.${index}`}
                    className="min-w-0"
                  >
                    {point}
                  </Editable>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ClassicStat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 text-center"
      style={{ color: "var(--report-text-colour, inherit)" }}
    >
      <Icon className="h-4 w-4 text-neutral-500" strokeWidth={1.75} aria-hidden />
      <span className="text-base font-semibold leading-none">{value}</span>
      <span className="text-[0.625rem] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
    </div>
  );
}
