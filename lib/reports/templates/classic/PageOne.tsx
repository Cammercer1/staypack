import type { FinalReportJson } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/reports/formatters";
import { MetricCard } from "@/components/reports/MetricCard";
import { AgentCard } from "@/components/reports/AgentCard";
import { ReportDisclaimer } from "@/components/reports/ReportDisclaimer";

export function ClassicPageOne({ report }: { report: FinalReportJson }) {
  const textColour = report.agency.text_colour || report.agency.primary_colour;
  const backgroundColour =
    report.agency.background_colour || report.agency.secondary_colour;

  return (
    <section
      className="report-page mx-auto shadow-sm"
      style={{
        backgroundColor: backgroundColour,
        color: textColour,
      }}
    >
      <div
        className="flex items-center justify-between border-b px-10 py-6"
        style={{ borderColor: `${textColour}20`, color: textColour }}
      >
        <div>
          {report.agency.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={report.agency.logo_url} alt="" className="mb-3 h-10 object-contain" />
          ) : null}
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            {report.copy.heading}
          </h1>
          <p className="text-sm opacity-70">
            Generated {new Date(report.generated_at).toLocaleDateString("en-AU")}
          </p>
        </div>
        {report.assets.qr_code_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={report.assets.qr_code_url} alt="QR code" className="h-24 w-24" />
        ) : null}
      </div>

      <div className="grid grid-cols-[1.2fr_1fr] gap-8 px-10 py-8">
        <div>
          {report.property.hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.property.hero_image_url}
              alt=""
              className="mb-6 aspect-[4/3] w-full rounded-xl object-cover"
            />
          ) : null}
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            {report.property.address}
          </h2>
          <p className="mt-1 text-sm opacity-70">
            {[report.property.suburb, report.property.state, report.property.postcode]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="mt-4 text-sm leading-6">{report.property.summary}</p>
        </div>

        <div className="space-y-4">
          <div
            className="rounded-2xl p-6 text-white"
            style={{ backgroundColor: report.agency.primary_colour }}
          >
            <p
              className="text-sm uppercase tracking-wide opacity-80"
              style={{ fontFamily: "var(--report-heading-font, inherit)" }}
            >
              Estimated gross STR revenue before costs
            </p>
            <p
              className="mt-2 text-4xl font-semibold"
              style={{ fontFamily: "var(--report-heading-font, inherit)" }}
            >
              {formatCurrency(report.str.annual_revenue)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Annual revenue" value={formatCurrency(report.str.annual_revenue)} />
            <MetricCard label="Monthly revenue" value={formatCurrency(report.str.monthly_revenue)} />
            <MetricCard label="Average nightly rate" value={formatCurrency(report.str.nightly_rate)} />
            <MetricCard label="Occupancy" value={formatPercent(report.str.occupancy_rate)} />
          </div>
        </div>
      </div>

      <div className="space-y-6 px-10 pb-8">
        <p className="leading-7">{report.copy.blurb}</p>
        <ul className="grid gap-2 md:grid-cols-2">
          {report.copy.appeal_points.map((point) => (
            <li
              key={point}
              className="rounded-lg px-4 py-3 text-sm"
              style={{ backgroundColor: report.agency.accent_colour }}
            >
              {point}
            </li>
          ))}
        </ul>
        <AgentCard agent={report.agent} agency={report.agency} />
        <ReportDisclaimer text={report.copy.disclaimer} short />
      </div>
    </section>
  );
}
