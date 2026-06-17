import {
  formatStrGrossYield,
  resolveStrGrossYield,
} from "@/lib/reports/calculateStrYield";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/reports/formatters";
import {
  ReportSnapshotStatsBar,
  type ReportSnapshotStat,
} from "@/lib/reports/templates/shared/ReportSnapshotStatsBar";
import type { FinalReportJson } from "@/lib/types";

type Props = {
  report: FinalReportJson;
  compact?: boolean;
};

const headingFont = "var(--report-heading-font, inherit)";

function buildSnapshotStats(report: FinalReportJson): ReportSnapshotStat[] {
  const { str, str_enrichment: enrichment } = report;
  const range = enrichment?.revenue_range;
  const grossYield = resolveStrGrossYield({
    display_price: report.property.display_price,
    annual_revenue: str.annual_revenue,
    str_yield: report.str_yield,
  });

  const stats: ReportSnapshotStat[] = [];

  const positioned =
    enrichment?.positioning != null && enrichment.positioning.percentile !== 50;

  if (str.annual_revenue != null) {
    stats.push({
      id: "median",
      label: positioned ? "Est. gross revenue" : "Median gross revenue",
      value: formatCurrency(str.annual_revenue),
      footnote: "per year before costs",
    });
  }

  if (grossYield) {
    stats.push({
      id: "yield",
      label: "Est. gross STR yield",
      value: formatStrGrossYield(grossYield),
    });
  }

  if (range?.p25 != null && range.p75 != null) {
    stats.push({
      id: "range",
      label: "Annual range",
      value: `${formatCurrency(range.p25)} – ${formatCurrency(range.p75)}`,
    });
  }

  if (str.occupancy_rate != null) {
    stats.push({
      id: "occupancy",
      label: "Occupancy",
      value: formatPercent(str.occupancy_rate),
    });
  }

  if (stats.length < 4 && str.nightly_rate != null) {
    stats.push({
      id: "nightly",
      label: "Nightly rate",
      value: `${formatCurrency(str.nightly_rate)}/night`,
    });
  }

  if (stats.length < 4 && enrichment?.comp_count) {
    stats.push({
      id: "comps",
      label: "Comparable listings",
      value: formatNumber(enrichment.comp_count),
    });
  }

  return stats.slice(0, 4);
}

export function ClassicMarketInsights({ report, compact = false }: Props) {
  const stats = buildSnapshotStats(report);

  if (stats.length === 0) {
    return null;
  }

  const accent = report.agency.primary_colour;

  return (
    <div>
      <h2
        className={`font-semibold ${compact ? "mb-2.5 text-base" : "mb-3 text-base"}`}
        style={{
          fontFamily: headingFont,
          color: accent ?? "var(--report-headline-colour, inherit)",
        }}
      >
        Market snapshot
      </h2>

      <ReportSnapshotStatsBar stats={stats} accent={accent} compact={compact} />
    </div>
  );
}
