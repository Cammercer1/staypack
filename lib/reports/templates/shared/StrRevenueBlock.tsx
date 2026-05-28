import { formatCurrency } from "@/lib/reports/formatters";
import type { FinalReportJson } from "@/lib/types";

const headingFont = "var(--report-heading-font, inherit)";
const bodyFont = "var(--report-body-font, inherit)";

/** Resolve agents from report, falling back to singular agent field. */
export function resolveReportAgents(report: FinalReportJson): FinalReportJson["agent"][] {
  if (report.agents?.length) {
    return report.agents.filter((a) => a.name || a.photo_url || a.phone || a.email);
  }
  if (report.agent.name || report.agent.photo_url || report.agent.phone || report.agent.email) {
    return [report.agent];
  }
  return [];
}

/** Primary revenue highlight box. Drop into the "price / sidebar" slot of any template. */
export function StrRevenueBlock({
  report,
  compact = false,
}: {
  report: FinalReportJson;
  compact?: boolean;
}) {
  const { str, copy } = report;
  if (!str.annual_revenue) return null;

  return (
    <div className="p-4" style={{ backgroundColor: "var(--report-soft-highlight, #f3f4f6)" }}>
      <p
        className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-neutral-600"
        style={{ fontFamily: headingFont }}
      >
        Estimated gross STR revenue
      </p>
      <p
        className="mt-1.5 font-semibold leading-none tracking-tight"
        style={{
          fontFamily: headingFont,
          fontSize: compact ? "1.5rem" : "2rem",
          color: "var(--report-text-colour, inherit)",
        }}
      >
        {formatCurrency(str.annual_revenue)}
      </p>
      <p className="mt-1.5 text-[0.75rem] font-medium text-neutral-600">per year before costs</p>
      {copy.key_metrics_line ? (
        <p className="mt-2 border-t border-neutral-200/70 pt-2 text-[0.68rem] leading-[1.6] text-neutral-600">
          {copy.key_metrics_line}
        </p>
      ) : null}
    </div>
  );
}

/** Compact inline stat row — nightly rate + occupancy. */
export function StrStatRow({ report }: { report: FinalReportJson }) {
  const { str } = report;
  const items: { label: string; value: string }[] = [];

  if (str.nightly_rate) {
    items.push({ label: "Per night", value: formatCurrency(str.nightly_rate) });
  }
  if (str.occupancy_rate) {
    items.push({ label: "Occupancy", value: `${Math.round(str.occupancy_rate * 100)}%` });
  }

  if (!items.length) return null;

  return (
    <div className="flex gap-6">
      {items.map((item) => (
        <div key={item.label}>
          <p
            className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-neutral-500"
            style={{ fontFamily: headingFont }}
          >
            {item.label}
          </p>
          <p
            className="mt-0.5 text-[0.9rem] font-bold text-neutral-900"
            style={{ fontFamily: headingFont }}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Flat print-style agent block (no card background). */
export function ReportAgentBlock({
  agent,
  accent,
}: {
  agent: FinalReportJson["agent"];
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {agent.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agent.photo_url}
          alt={agent.name || "Agent"}
          className="h-14 w-14 shrink-0 rounded-full object-cover object-top"
        />
      ) : (
        <div
          className="h-14 w-14 shrink-0 rounded-full"
          style={{ backgroundColor: `${accent}22` }}
        />
      )}
      <div className="min-w-0">
        {agent.name ? (
          <p
            className="text-[0.82rem] font-bold leading-tight text-neutral-900"
            style={{ fontFamily: headingFont }}
          >
            {agent.name}
          </p>
        ) : null}
        {agent.role_title ? (
          <p className="text-[0.7rem] text-neutral-500" style={{ fontFamily: bodyFont }}>
            {agent.role_title}
          </p>
        ) : null}
        {agent.phone ? (
          <p className="text-[0.72rem] text-neutral-700" style={{ fontFamily: bodyFont }}>
            {agent.phone}
          </p>
        ) : null}
        {agent.email ? (
          <p className="truncate text-[0.68rem] text-neutral-500" style={{ fontFamily: bodyFont }}>
            {agent.email}
          </p>
        ) : null}
      </div>
    </div>
  );
}
