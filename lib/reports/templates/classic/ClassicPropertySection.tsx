import { Bath, BedDouble, Car, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FinalReportJson } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/reports/formatters";
import { STR_ANNUAL_REVENUE_LABEL } from "@/lib/reports/resolveStrBrochurePrice";
import {
  ReportCopyAppealPoint,
  ReportCopyBlurb,
  ReportCopyHeading,
  ReportCopyKeyMetricsLine,
} from "@/components/reports/inline/ReportCopyFields";
import { LtrRentBlock } from "@/lib/reports/templates/shared/LtrRentBlock";
import {
  isLeasePageVariant,
  isSalePageVariant,
  showGuestStat,
  type ReportPageVariant,
} from "@/lib/reports/templates/shared/reportPageVariant";

type Props = {
  report: FinalReportJson;
  reportVariant?: ReportPageVariant;
};

export function ClassicPropertySection({
  report,
  reportVariant = "str",
}: Props) {
  const { property, str, copy } = report;
  const isLease = isLeasePageVariant(reportVariant);
  const isSale = isSalePageVariant(reportVariant);

  const propertyStats = [
    { id: "bedrooms", icon: BedDouble, value: formatNumber(property.bedrooms), label: "Beds" },
    { id: "bathrooms", icon: Bath, value: formatNumber(property.bathrooms), label: "Bath" },
    { id: "car_spaces", icon: Car, value: formatNumber(property.car_spaces), label: "Car" },
    ...(showGuestStat(reportVariant)
      ? [
          {
            id: "accommodates",
            icon: Users,
            value: formatNumber(property.accommodates),
            label: "Guests",
          },
        ]
      : []),
  ];

  return (
    <div className="grid shrink-0 grid-cols-[1.15fr_0.85fr] gap-8 px-10 py-5">
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <h2
            className="text-[1.65rem] font-semibold leading-tight"
            style={{
              fontFamily: "var(--report-heading-font, inherit)",
              color: "var(--report-headline-colour, inherit)",
            }}
          >
            {property.address}
          </h2>
          {copy.heading ? (
            <ReportCopyHeading
              text={copy.heading}
              as="p"
              className="mt-3 text-lg font-semibold leading-snug"
              style={{
                fontFamily: "var(--report-heading-font, inherit)",
                color: "var(--report-text-colour, inherit)",
              }}
            />
          ) : null}
        </div>

        {copy.blurb ? (
          <ReportCopyBlurb
            blurb={copy.blurb}
            paraClassName="text-[0.95rem] leading-7 text-neutral-800"
          />
        ) : property.summary ? (
          <p className="text-[0.95rem] leading-7 text-neutral-800">{property.summary}</p>
        ) : null}

        {copy.appeal_points?.length ? (
          <ul className="flex flex-col gap-2.5 pt-1">
            {copy.appeal_points.slice(0, 4).map((point, index) => (
              <li
                key={`${index}-${point.slice(0, 24)}`}
                className="flex gap-2.5 text-[0.82rem] leading-relaxed text-neutral-700"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" aria-hidden />
                <ReportCopyAppealPoint index={index} text={point} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <div className="grid grid-cols-4 gap-2">
          {propertyStats.map((item) => (
            <ClassicStatBox
              key={item.id}
              icon={item.icon}
              value={item.value}
              label={item.label}
            />
          ))}
        </div>

        {isLease ? (
          <LtrRentBlock report={report} />
        ) : isSale && property.display_price ? (
          <div
            className="p-4"
            style={{ backgroundColor: "var(--report-soft-highlight, #f3f4f6)" }}
          >
            <p
              className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-neutral-600"
              style={{ fontFamily: "var(--report-heading-font, inherit)" }}
            >
              Price guide
            </p>
            <p
              className="mt-2 text-[2rem] font-semibold leading-none tracking-tight"
              style={{
                fontFamily: "var(--report-heading-font, inherit)",
                color: "var(--report-text-colour, inherit)",
              }}
            >
              {property.display_price}
            </p>
          </div>
        ) : (
          <div
            className="p-4"
            style={{ backgroundColor: "var(--report-soft-highlight, #f3f4f6)" }}
          >
            <p
              className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-neutral-600"
              style={{ fontFamily: "var(--report-heading-font, inherit)" }}
            >
              {STR_ANNUAL_REVENUE_LABEL}
            </p>
            <p
              className="mt-2 text-[2rem] font-semibold leading-none tracking-tight"
              style={{
                fontFamily: "var(--report-heading-font, inherit)",
                color: "var(--report-text-colour, inherit)",
              }}
            >
              {formatCurrency(str.annual_revenue)}
            </p>
            <p className="mt-2 text-sm font-medium text-neutral-700">per year before costs</p>
            {copy.key_metrics_line ? (
              <ReportCopyKeyMetricsLine
                text={copy.key_metrics_line}
                as="p"
                className="mt-3 border-t border-neutral-200/70 pt-3 text-xs leading-5 text-neutral-600"
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ClassicStatBox({
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
      className="flex flex-col items-center justify-center gap-1.5 border border-neutral-200/80 px-1 py-2.5 text-center"
      style={{
        backgroundColor: "var(--report-soft-highlight, #f3f4f6)",
        color: "var(--report-text-colour, inherit)",
      }}
    >
      <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
      <span className="text-base font-semibold leading-none">{value}</span>
      <span className="text-[0.625rem] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
    </div>
  );
}
