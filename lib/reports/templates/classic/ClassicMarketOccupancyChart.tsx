import type { StrMarketOccupancy } from "@/lib/types";
import { formatMonthLabel, formatPercent } from "@/lib/reports/formatters";

/** Historical market evidence stays separate from the subject's modelled revenue allocation. */
export function ClassicMarketOccupancyChart({ history, chartColour }: { history: StrMarketOccupancy; chartColour: string }) {
  const rows = history.months;
  if (history.status !== "available" || !rows.length) return null;
  const latest = rows.at(-1)!;
  const end = new Date(`${latest.month}-01T00:00:00Z`);
  const slots = Array.from({ length: 12 }, (_, index) => {
    const key = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11 + index, 1)).toISOString().slice(0, 7);
    return { key, point: rows.find((row) => row.month === key) };
  });
  const peak = rows.reduce((best, row) => row.p50 > best.p50 ? row : best);
  const label = (month: string) => `${formatMonthLabel(month)} ${month.slice(2, 4)}`;
  const x = (index: number) => 33 + index * 26;
  const y = (value: number) => 105 - value * .88;
  return <div className="flex h-full flex-col">
    <div className="mb-2 flex h-10 items-start justify-between gap-2">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-neutral-600">Market occupancy history</p>
      <div className="shrink-0 text-right">
        <p className="text-[0.58rem] uppercase text-neutral-500">Peak median</p>
        <p className="text-[0.85rem] font-semibold">{formatPercent(peak.p50)}</p>
      </div>
    </div>
    <div className="flex h-[7.25rem] flex-col border-y border-neutral-200 py-2">
      <svg viewBox="0 0 340 113" className="min-h-0 w-full flex-1" role="img" aria-label="Historical market occupancy: median and 25th–75th percentiles">
        {[0, 50, 100].map((value) => <g key={value}>
          <line x1="23" x2="332" y1={y(value)} y2={y(value)} stroke="#e5e5e5" strokeWidth="1" />
          <text x="20" y={y(value) + 3} textAnchor="end" className="fill-neutral-500 text-[8px]">{value}%</text>
        </g>)}
        {slots.map(({ key, point }, index) => point ? <g key={key}>
          <title>{`${label(key)}: median ${formatPercent(point.p50)}, 25th–75th ${formatPercent(point.p25)}–${formatPercent(point.p75)}, average ${formatPercent(point.average)}`}</title>
          <rect x={x(index) - 8} y={y(point.p75)} width="16" height={Math.max(1, y(point.p25) - y(point.p75))} fill={chartColour} opacity=".25" />
          <line x1={x(index) - 8} x2={x(index) + 8} y1={y(point.p50)} y2={y(point.p50)} stroke={chartColour} strokeWidth="3" />
        </g> : <g key={key}><title>{`${label(key)}: unavailable`}</title><text x={x(index)} y="103" textAnchor="middle" className="fill-neutral-400 text-[9px]">—</text></g>)}
      </svg>
      <div className="mt-1 grid grid-cols-12 gap-1 pl-5 text-center text-[0.58rem] font-medium text-neutral-500">
        {slots.map(({ key }) => <span key={key}>{formatMonthLabel(key)}</span>)}
      </div>
    </div>
    <p className="mt-1.5 text-[0.55rem] leading-snug text-neutral-500">
      {history.label} · {label(rows[0].month)}–{label(latest.month)}.<br />
      Median line; 25th–75th percentile band. Estimated market history, not a subject forecast.
    </p>
  </div>;
}
