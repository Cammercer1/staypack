import { Bath, BedDouble, Car, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FinalReportJson } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/reports/formatters";

type Props = {
  report: FinalReportJson;
  variant?: "light" | "detailed";
};

export function ClassicPropertySection({ report, variant = "light" }: Props) {
  const { property, str, copy } = report;

  const propertyStats = [
    { id: "bedrooms", icon: BedDouble, value: formatNumber(property.bedrooms), label: "Beds" },
    { id: "bathrooms", icon: Bath, value: formatNumber(property.bathrooms), label: "Bath" },
    { id: "car_spaces", icon: Car, value: formatNumber(property.car_spaces), label: "Car" },
    {
      id: "accommodates",
      icon: Users,
      value: formatNumber(property.accommodates),
      label: "Guests",
    },
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
            <p
              className="mt-3 text-lg font-semibold leading-snug"
              style={{
                fontFamily: "var(--report-heading-font, inherit)",
                color: "var(--report-text-colour, inherit)",
              }}
            >
              {copy.heading}
            </p>
          ) : null}
        </div>

        {copy.blurb ? (
          <p className="text-[0.95rem] leading-7 text-neutral-800">{copy.blurb}</p>
        ) : property.summary ? (
          <p className="text-[0.95rem] leading-7 text-neutral-800">{property.summary}</p>
        ) : null}

        {variant === "detailed" && copy.appeal_points?.length ? (
          <ul className="flex flex-col gap-2.5 pt-1">
            {copy.appeal_points.slice(0, 3).map((point) => (
              <li
                key={point}
                className="flex gap-2.5 text-[0.82rem] leading-relaxed text-neutral-700"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" aria-hidden />
                <span>{point}</span>
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

        <div
          className="p-4"
          style={{ backgroundColor: "var(--report-soft-highlight, #f3f4f6)" }}
        >
          <p
            className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-neutral-600"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            Estimated gross STR revenue
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
          {variant === "detailed" && report.str_enrichment?.revenue_range ? (
            <p className="mt-2 text-xs leading-5 text-neutral-600">
              Market range (annual gross):{" "}
              {formatCurrency(report.str_enrichment.revenue_range.p25)} –{" "}
              {formatCurrency(report.str_enrichment.revenue_range.p75)}
            </p>
          ) : null}
          {copy.key_metrics_line ? (
            <p className="mt-3 border-t border-neutral-200/70 pt-3 text-xs leading-5 text-neutral-600">
              {copy.key_metrics_line}
            </p>
          ) : null}
        </div>
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
