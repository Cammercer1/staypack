const headingFont = "var(--report-heading-font, inherit)";

export type ReportSnapshotStat = {
  id: string;
  label: string;
  value: string;
  footnote?: string;
};

type Props = {
  stats: ReportSnapshotStat[];
  /** Bar fill — defaults to --report-soft-highlight (agency accent / primary). */
  accent?: string;
  compact?: boolean;
};

/** Equal-width stat band used on STR page 2 and lease appraisal page 2. */
export function ReportSnapshotStatsBar({ stats, accent, compact = false }: Props) {
  if (stats.length === 0) {
    return null;
  }

  const statLabelClass =
    "text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/80";
  const statValueClass = compact ? "mt-1.5 text-[1.05rem]" : "mt-1.5 text-[1.15rem]";

  return (
    <div
      className={compact ? "px-6 py-4" : "px-8 py-5"}
      style={{
        backgroundColor: accent ?? "var(--report-soft-highlight, #f3f4f6)",
      }}
    >
      <div
        className="grid gap-8"
        style={{
          gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
        }}
      >
        {stats.map((stat) => (
          <div key={stat.id} className="min-w-0">
            <p className={statLabelClass} style={{ fontFamily: headingFont }}>
              {stat.label}
            </p>
            <p
              className={`font-semibold leading-snug text-white ${statValueClass}`}
              style={{ fontFamily: headingFont }}
            >
              {stat.value}
            </p>
            {stat.footnote ? (
              <p className="mt-1 text-[0.72rem] text-white/85">{stat.footnote}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
