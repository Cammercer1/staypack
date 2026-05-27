import type { FinalReportJson } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/reports/formatters";
import { MetricCard } from "@/components/reports/MetricCard";
import { AgentCard } from "@/components/reports/AgentCard";
import { ReportDisclaimer } from "@/components/reports/ReportDisclaimer";

export function ClassicPageTwo({ report }: { report: FinalReportJson }) {
  const hasLtr =
    report.ltr.weekly_min != null ||
    report.ltr.weekly_max != null ||
    report.ltr.weekly_midpoint != null;

  return (
    <section className="report-page mx-auto shadow-sm">
      <div className="space-y-8 px-10 py-10">
        {hasLtr ? (
          <div>
            <h2
              className="text-xl font-semibold"
              style={{ fontFamily: "var(--report-heading-font, inherit)" }}
            >
              STR vs long-term rental comparison
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <MetricCard
                label="LTR weekly midpoint"
                value={formatCurrency(report.ltr.weekly_midpoint)}
              />
              <MetricCard
                label="Estimated gross STR revenue"
                value={formatCurrency(report.str.annual_revenue)}
              />
              <MetricCard
                label="Difference before costs"
                value={formatCurrency(report.ltr.difference_before_costs)}
              />
            </div>
          </div>
        ) : null}

        <div>
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            Performance breakdown
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <MetricCard label="Average nightly rate" value={formatCurrency(report.str.nightly_rate)} />
            <MetricCard label="Occupancy" value={formatPercent(report.str.occupancy_rate)} />
            <MetricCard label="Booked nights" value={formatNumber(report.str.booked_nights)} />
            <MetricCard
              label="Estimated gross revenue"
              value={formatCurrency(report.str.annual_revenue)}
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <ListSection title="Factors that may support performance" items={report.copy.supporting_factors} />
          <ListSection title="Things buyers should check" items={report.copy.buyer_checks} />
        </div>

        <div>
          <h3
            className="font-semibold"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            Methodology note
          </h3>
          <p className="mt-2 text-sm leading-6">{report.copy.methodology_note}</p>
        </div>

        <ReportDisclaimer text={report.copy.disclaimer} />
        <AgentCard agent={report.agent} agency={report.agency} cta={report.copy.cta} />
      </div>
    </section>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3
        className="font-semibold"
        style={{ fontFamily: "var(--report-heading-font, inherit)" }}
      >
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-lg bg-muted px-4 py-3 text-sm">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
