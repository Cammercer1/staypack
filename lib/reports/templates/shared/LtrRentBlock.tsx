import {
  formatRentCalloutSubline,
  rentCalloutFromReport,
} from "@/lib/lease-appraisal/formatRentCallout";
import type { FinalReportJson } from "@/lib/types";

const headingFont = "var(--report-heading-font, inherit)";
const bodyFont = "var(--report-body-font, inherit)";

export function LtrRentBlock({
  report,
  compact = false,
  onAccent = false,
}: {
  report: FinalReportJson;
  compact?: boolean;
  onAccent?: boolean;
}) {
  const { ltr, copy } = report;
  const amount =
    ltr.weekly_min != null && ltr.weekly_max != null
      ? rentCalloutFromReport(ltr)
      : null;

  if (!amount) {
    return null;
  }

  const labelClass = onAccent
    ? "text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/85"
    : "text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-neutral-600";
  const subClass = onAccent
    ? "mt-1.5 text-[0.75rem] font-medium text-white/90"
    : "mt-1.5 text-[0.75rem] font-medium text-neutral-600";
  const metricsClass = onAccent
    ? "mt-2 border-t border-white/25 pt-2 text-[0.68rem] leading-[1.6] text-white/85"
    : "mt-2 border-t border-neutral-200/70 pt-2 text-[0.68rem] leading-[1.6] text-neutral-600";

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: onAccent
          ? "var(--report-soft-highlight, var(--report-headline-colour, #009eca))"
          : "var(--report-soft-highlight, #f3f4f6)",
      }}
    >
      <p className={labelClass} style={{ fontFamily: headingFont }}>
        Estimated weekly rent
      </p>
      <p
        className="mt-1.5 font-semibold leading-none tracking-tight"
        style={{
          fontFamily: headingFont,
          fontSize: compact ? "1.5rem" : "2rem",
          color: onAccent ? "#ffffff" : "var(--report-text-colour, inherit)",
        }}
      >
        {amount}
      </p>
      <p className={subClass}>per week before costs</p>
      {copy.key_metrics_line ? (
        <p className={metricsClass}>{copy.key_metrics_line}</p>
      ) : (
        <p className={metricsClass}>
          {formatRentCalloutSubline(report.ltr_enrichment?.comp_count)}
        </p>
      )}
    </div>
  );
}
