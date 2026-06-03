import type { FinalReportJson } from "@/lib/types";
import { formatCurrency, formatMonthLabel } from "@/lib/reports/formatters";

type Props = {
  report: FinalReportJson;
  compact?: boolean;
  /** Chart line/band colour — defaults to agency headline colour. */
  chartColour?: string;
};

const CHART_WIDTH = 520;
const CHART_HEIGHT = 108;
const PAD_X = 28;
const PAD_Y = 14;
const DEFAULT_CHART_COLOUR = "var(--report-headline-colour, #009eca)";

function formatAxisCurrency(value: number) {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}k`;
  }

  return `$${Math.round(value)}`;
}

function buildPoint(
  index: number,
  count: number,
  value: number,
  maxValue: number,
) {
  const plotWidth = CHART_WIDTH - PAD_X * 2;
  const plotHeight = CHART_HEIGHT - PAD_Y * 2;
  const x = PAD_X + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);
  const y = PAD_Y + plotHeight - (value / maxValue) * plotHeight;

  return { x, y };
}

function buildLinePath(values: number[], maxValue: number) {
  return values
    .map((value, index) => {
      const point = buildPoint(index, values.length, value, maxValue);
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function buildBandPath(
  lowValues: number[],
  highValues: number[],
  maxValue: number,
) {
  const count = lowValues.length;
  const lowPoints = lowValues.map((value, index) =>
    buildPoint(index, count, value, maxValue),
  );
  const highPoints = highValues.map((value, index) =>
    buildPoint(index, count, value, maxValue),
  );

  const forward = highPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const backward = [...lowPoints]
    .reverse()
    .map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  return `${forward} ${backward} Z`;
}

export function ClassicMonthlyRevenueChart({
  report,
  compact = false,
  chartColour = DEFAULT_CHART_COLOUR,
}: Props) {
  const headline = chartColour;
  const enrichment = report.str_enrichment;
  const rows = enrichment?.seasonality?.slice(-12) ?? [];

  const chartRows = rows.filter((row) => row.revenue != null);

  if (chartRows.length === 0) {
    return null;
  }

  const hasBands = chartRows.every(
    (row) => row.revenue_low != null && row.revenue_high != null,
  );

  const lowValues = hasBands
    ? chartRows.map((row) => row.revenue_low!)
    : chartRows.map((row) => row.revenue! * 0.75);
  const midValues = chartRows.map((row) => row.revenue!);
  const highValues = hasBands
    ? chartRows.map((row) => row.revenue_high!)
    : chartRows.map((row) => row.revenue! * 1.25);
  const maxValue = Math.max(...highValues, 1);
  const yTicks = [0, maxValue * 0.5, maxValue];

  const bandPath = buildBandPath(lowValues, highValues, maxValue);
  const midPath = buildLinePath(midValues, maxValue);
  const plotHeight = CHART_HEIGHT - PAD_Y * 2;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex h-10 items-start justify-between gap-3">
        <div>
          <p
            className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-neutral-600"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            Monthly revenue
          </p>
          {!compact ? (
            <p className="mt-1 text-xs text-neutral-600">
              Low, median and high from {enrichment?.comp_count ?? "nearby"} comps
              {enrichment?.radius_m
                ? ` within ${Math.round(enrichment.radius_m / 1000)} km`
                : ""}
              .
            </p>
          ) : null}
        </div>
        {report.str.annual_revenue != null ? (
          <div className="shrink-0 text-right">
            <p className="text-[0.58rem] font-medium uppercase tracking-wide text-neutral-500">
              Median annual
            </p>
            <p
              className="text-[0.85rem] font-semibold leading-tight"
              style={{
                fontFamily: "var(--report-heading-font, inherit)",
                color: "var(--report-text-colour, inherit)",
              }}
            >
              {formatCurrency(report.str.annual_revenue)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex h-[7.25rem] flex-col border-y border-neutral-200 py-2">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="min-h-0 w-full flex-1"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Monthly gross revenue projection chart"
        >
          {yTicks.map((tick) => {
            const y = PAD_Y + plotHeight - (tick / maxValue) * plotHeight;

            return (
              <g key={tick}>
                <line
                  x1={PAD_X}
                  x2={CHART_WIDTH - PAD_X}
                  y1={y}
                  y2={y}
                  stroke="#e5e5e5"
                  strokeWidth="1"
                />
                <text
                  x={PAD_X - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-neutral-400 text-[9px]"
                >
                  {formatAxisCurrency(tick)}
                </text>
              </g>
            );
          })}

          <path
            d={bandPath}
            fill={`color-mix(in srgb, ${headline} 22%, white)`}
            stroke="none"
          />
          <path
            d={midPath}
            fill="none"
            stroke={headline}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chartRows.map((row, index) => {
            const point = buildPoint(index, chartRows.length, row.revenue!, maxValue);

            return (
              <circle
                key={row.month}
                cx={point.x}
                cy={point.y}
                r="2.75"
                fill={headline}
              />
            );
          })}
        </svg>

        <div
          className="mt-1 grid text-center text-[0.58rem] font-medium text-neutral-500"
          style={{ gridTemplateColumns: `repeat(${chartRows.length}, minmax(0, 1fr))` }}
        >
          {chartRows.map((row) => (
            <span key={row.month}>{formatMonthLabel(row.month)}</span>
          ))}
        </div>
      </div>

      <p className="mt-1.5 min-h-[1.25rem] text-[0.55rem] leading-snug text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-1.5 w-2.5"
            style={{ backgroundColor: `color-mix(in srgb, ${headline} 22%, white)` }}
            aria-hidden
          />
          Range
        </span>
        <span className="mx-2 text-neutral-300">·</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-px w-2.5" style={{ backgroundColor: headline }} aria-hidden />
          Median
        </span>
      </p>
    </div>
  );
}
