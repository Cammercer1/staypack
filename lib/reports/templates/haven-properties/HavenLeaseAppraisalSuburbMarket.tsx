import { formatNumber } from "@/lib/reports/formatters";
import {
  ReportSnapshotStatsBar,
  type ReportSnapshotStat,
} from "@/lib/reports/templates/shared/ReportSnapshotStatsBar";
import type { LtrSuburbMarketJson } from "@/lib/types";

const headingFont = "var(--report-heading-font, inherit)";

function formatPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function formatCount(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return formatNumber(value);
}

function buildSuburbSnapshotStats(market: LtrSuburbMarketJson): ReportSnapshotStat[] {
  return [
    { id: "vacancy", label: "Vacancy rate", value: formatPct(market.vacancy_rate_pct) },
    { id: "yield", label: "Gross yield", value: formatPct(market.gross_yield_pct) },
    { id: "population", label: "Population", value: formatCount(market.population) },
    { id: "renters", label: "Renters", value: formatPct(market.renter_pct) },
  ];
}

type Props = {
  market: LtrSuburbMarketJson;
  /** Bar fill — defaults to --report-soft-highlight (Haven teal). */
  accent?: string;
  compact?: boolean;
};

function formatSuburbTitle(suburb: string) {
  return suburb
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Haven STR-style market snapshot band for LTR suburb stats (page 2 footer). */
export function HavenLeaseAppraisalSuburbMarket({
  market,
  accent,
  compact = false,
}: Props) {
  const suburbTitle = formatSuburbTitle(market.suburb ?? "");
  const stats = buildSuburbSnapshotStats(market);

  return (
    <div>
      {suburbTitle ? (
        <h2
          className={`font-semibold ${compact ? "mb-2.5 text-base" : "mb-3 text-base"}`}
          style={{
            fontFamily: headingFont,
            color: accent ?? "var(--report-headline-colour, inherit)",
          }}
        >
          {suburbTitle} Market Data
        </h2>
      ) : null}

      <ReportSnapshotStatsBar stats={stats} accent={accent} compact={compact} />
    </div>
  );
}
