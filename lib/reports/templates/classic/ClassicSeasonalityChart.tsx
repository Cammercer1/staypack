import type { StrEnrichmentJson } from "@/lib/types";
import { formatCurrency, formatMonthLabel, formatPercent } from "@/lib/reports/formatters";

type Props = {
  seasonality: StrEnrichmentJson["seasonality"];
  compact?: boolean;
};

const DEFAULT_CHART_COLOUR = "var(--report-headline-colour, #009eca)";

type ChartProps = Props & {
  chartColour?: string;
};

export function ClassicSeasonalityChart({
  seasonality,
  compact = false,
  chartColour = DEFAULT_CHART_COLOUR,
}: ChartProps) {
  const headline = chartColour;
  const rows = seasonality.slice(-12).filter((row) => row.occupancy != null);

  if (rows.length === 0) {
    return null;
  }

  const occupancies = rows.map((row) => row.occupancy ?? 0);
  const maxOccupancy = Math.max(...occupancies, 1);
  const peak = rows.reduce((best, row) =>
    (row.occupancy ?? 0) > (best.occupancy ?? 0) ? row : best,
  );
  const low = rows.reduce((best, row) =>
    (row.occupancy ?? 0) < (best.occupancy ?? 0) ? row : best,
  );
  const avgAdr =
    rows.reduce((sum, row) => sum + (row.adr ?? 0), 0) / rows.length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex h-10 items-start justify-between gap-3">
        <p
          className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-neutral-600"
          style={{ fontFamily: "var(--report-heading-font, inherit)" }}
        >
          Occupancy
        </p>
        {!compact ? (
          <p className="text-[0.58rem] text-neutral-500">
            Peak {formatMonthLabel(peak.month)} · Low {formatMonthLabel(low.month)}
          </p>
        ) : (
          <div className="shrink-0 text-right">
            <p className="text-[0.58rem] font-medium uppercase tracking-wide text-neutral-500">
              Peak month
            </p>
            <p
              className="text-[0.85rem] font-semibold leading-tight"
              style={{
                fontFamily: "var(--report-heading-font, inherit)",
                color: "var(--report-text-colour, inherit)",
              }}
            >
              {formatPercent(peak.occupancy)}
            </p>
          </div>
        )}
      </div>

      <div className="flex h-[7.25rem] flex-col border-y border-neutral-200 py-2">
        <div className="grid min-h-0 flex-1 grid-cols-12 items-end gap-1">
          {rows.map((row) => {
            const occupancy = row.occupancy ?? 0;
            const height = Math.max(10, Math.round((occupancy / maxOccupancy) * 100));

            return (
              <div key={row.month} className="flex h-full min-w-0 flex-col justify-end">
                <div
                  className="w-full"
                  style={{
                    height: `${height}%`,
                    backgroundColor: `color-mix(in srgb, ${headline} ${row.month === peak.month ? "100%" : row.month === low.month ? "35%" : "58%"}, white)`,
                  }}
                  title={`${formatMonthLabel(row.month)}: ${formatPercent(row.occupancy)}`}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-1 grid grid-cols-12 gap-1 text-center text-[0.58rem] font-medium text-neutral-500">
          {rows.map((row) => (
            <span key={row.month} className="min-w-0 truncate">
              {formatMonthLabel(row.month)}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-1.5 min-h-[1.25rem] text-[0.55rem] leading-snug text-neutral-500">
        Peak {formatMonthLabel(peak.month)} {formatPercent(peak.occupancy)} · Quiet{" "}
        {formatMonthLabel(low.month)} {formatPercent(low.occupancy)} · Avg{" "}
        {formatCurrency(avgAdr)}/night
      </p>
    </div>
  );
}
