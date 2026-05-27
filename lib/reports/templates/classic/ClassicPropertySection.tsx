import { Bath, BedDouble, Car, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FinalReportJson } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/reports/formatters";

type Props = {
  report: FinalReportJson;
};

export function ClassicPropertySection({ report }: Props) {
  const accent = report.agency.primary_colour;
  const textColour = report.agency.text_colour || report.agency.primary_colour;
  const { property, str, copy } = report;

  const propertyStats = [
    { id: "bedrooms", icon: BedDouble, value: formatNumber(property.bedrooms) },
    { id: "bathrooms", icon: Bath, value: formatNumber(property.bathrooms) },
    { id: "car_spaces", icon: Car, value: formatNumber(property.car_spaces) },
    { id: "accommodates", icon: Users, value: formatNumber(property.accommodates) },
  ];

  return (
    <div
      className="grid flex-1 grid-cols-[1.15fr_0.85fr] gap-10 px-10 py-8"
      style={{ color: textColour }}
    >
      <div className="flex flex-col gap-5">
        <div>
          <h2
            className="text-[1.65rem] font-semibold leading-tight"
            style={{ fontFamily: "var(--report-heading-font, inherit)", color: accent }}
          >
            {property.address}
          </h2>
          {copy.heading ? (
            <p
              className="mt-3 text-lg font-semibold leading-snug"
              style={{ fontFamily: "var(--report-heading-font, inherit)", color: accent }}
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
      </div>

      <div className="flex flex-col items-end text-right">
        <div className="grid w-full grid-cols-4 gap-2">
          {propertyStats.map((item) => (
            <ClassicStatBox
              key={item.id}
              icon={item.icon}
              value={item.value}
              accent={accent}
            />
          ))}
        </div>

        <div className="mt-6 w-full">
          <p
            className="text-2xl font-semibold uppercase tracking-wide"
            style={{ fontFamily: "var(--report-heading-font, inherit)", color: accent }}
          >
            Estimated gross STR revenue
          </p>
          <p
            className="mt-1 text-xl font-medium text-neutral-900"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            {formatCurrency(str.annual_revenue)} per year before costs
          </p>
          {copy.key_metrics_line ? (
            <p className="mt-2 text-sm leading-6 text-neutral-700">{copy.key_metrics_line}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ClassicStatBox({
  icon: Icon,
  value,
  accent,
}: {
  icon: LucideIcon;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="flex aspect-square flex-col items-center justify-center gap-1 border px-1 py-2 text-center"
      style={{ borderColor: accent, color: accent }}
    >
      <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
      <span className="text-sm font-semibold leading-none">{value}</span>
    </div>
  );
}
