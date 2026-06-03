import type { FinalReportJson } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/reports/formatters";
import {
  formatStrGrossYield,
  resolveStrGrossYield,
} from "@/lib/reports/calculateStrYield";

type Props = {
  report: FinalReportJson;
  /** White type on accent highlight band (Haven market snapshot). */
  invertedHighlight?: boolean;
  compact?: boolean;
};

type SnapshotStat = {
  id: string;
  label: string;
  value: string;
};

function buildSnapshotStats(report: FinalReportJson) {
  const { str, str_enrichment: enrichment } = report;
  const range = enrichment?.revenue_range;
  const grossYield = resolveStrGrossYield({
    display_price: report.property.display_price,
    annual_revenue: str.annual_revenue,
    str_yield: report.str_yield,
  });

  const supporting: SnapshotStat[] = [];

  if (grossYield) {
    supporting.push({
      id: "yield",
      label: "Est. gross STR yield",
      value: formatStrGrossYield(grossYield),
    });
  }

  if (range?.p25 != null && range.p75 != null) {
    supporting.push({
      id: "range",
      label: "Annual range",
      value: `${formatCurrency(range.p25)} – ${formatCurrency(range.p75)}`,
    });
  }

  if (str.occupancy_rate != null) {
    supporting.push({
      id: "occupancy",
      label: "Occupancy",
      value: formatPercent(str.occupancy_rate),
    });
  }

  if (str.nightly_rate != null) {
    supporting.push({
      id: "nightly",
      label: "Nightly rate",
      value: `${formatCurrency(str.nightly_rate)}/night`,
    });
  }

  if (enrichment?.comp_count) {
    supporting.push({
      id: "comps",
      label: "Comparable listings",
      value: formatNumber(enrichment.comp_count),
    });
  }

  return {
    median: str.annual_revenue,
    supporting: supporting.slice(0, 3),
  };
}

export function ClassicMarketInsights({
  report,
  invertedHighlight = false,
  compact = false,
}: Props) {
  const { median, supporting } = buildSnapshotStats(report);

  if (median == null && supporting.length === 0) {
    return null;
  }

  const statLabelClass = invertedHighlight
    ? "text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/80"
    : "text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-neutral-500";
  const statValueColor = invertedHighlight ? "#ffffff" : "var(--report-text-colour, inherit)";
  const medianSubClass = invertedHighlight
    ? "mt-2 text-[0.72rem] text-white/85"
    : "mt-2 text-[0.72rem] text-neutral-600";

  return (
    <div>
      <p
        className={`font-semibold uppercase tracking-[0.14em] text-neutral-600 ${
          compact ? "mb-2.5 text-[0.65rem]" : "mb-3 text-[0.7rem]"
        }`}
        style={{ fontFamily: "var(--report-heading-font, inherit)" }}
      >
        Market snapshot
      </p>

      <div
        className={compact ? "px-6 py-4" : "px-8 py-5"}
        style={{ backgroundColor: "var(--report-soft-highlight, #f3f4f6)" }}
      >
        <div className="flex items-stretch gap-8">
          {median != null ? (
            <div className="min-w-[9.5rem] shrink-0 pr-8">
              <p
                className={statLabelClass}
                style={{ fontFamily: "var(--report-heading-font, inherit)" }}
              >
                Median gross revenue
              </p>
              <p
                className={`font-semibold leading-none tracking-tight ${
                  compact ? "mt-1.5 text-[1.65rem]" : "mt-2 text-[2.1rem]"
                }`}
                style={{
                  fontFamily: "var(--report-heading-font, inherit)",
                  color: statValueColor,
                }}
              >
                {formatCurrency(median)}
              </p>
              <p className={medianSubClass}>per year before costs</p>
            </div>
          ) : null}

          {supporting.length > 0 ? (
            <div
              className="grid min-w-0 flex-1 content-center gap-x-8 gap-y-4"
              style={{
                gridTemplateColumns: `repeat(${Math.min(supporting.length, 3)}, minmax(0, 1fr))`,
              }}
            >
              {supporting.map((stat) => (
                <div key={stat.id} className="min-w-0">
                  <p
                    className={statLabelClass}
                    style={{ fontFamily: "var(--report-heading-font, inherit)" }}
                  >
                    {stat.label}
                  </p>
                  <p
                    className="mt-1.5 text-[1.05rem] font-semibold leading-snug"
                    style={{
                      fontFamily: "var(--report-heading-font, inherit)",
                      color: statValueColor,
                    }}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
