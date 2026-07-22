import Image from "next/image";
import {
  ReportCopyDisclaimer,
  ReportCopyTextField,
} from "@/components/reports/inline/ReportCopyFields";
import {
  formatCurrency,
  formatDistanceMeters,
  formatPercent,
} from "@/lib/reports/formatters";
import { ClassicMonthlyRevenueChart } from "@/lib/reports/templates/classic/ClassicMonthlyRevenueChart";
import { ClassicSeasonalityChart } from "@/lib/reports/templates/classic/ClassicSeasonalityChart";
import type { FinalReportJson, StrCompCard } from "@/lib/types";

const OC_CREAM = "#F2E3CF";
const OC_ORANGE = "#AB592A";

function OcStrComparableCard({ comp }: { comp: StrCompCard }) {
  return (
    <article className="flex h-[178px] min-w-0 flex-col overflow-hidden border-t border-[#C0A591] bg-[#F2E3CF] pt-2">
      <div className="relative h-[88px] shrink-0 overflow-hidden bg-[#D8CDC0]">
        {comp.thumbnail_url ? (
          <Image
            src={comp.thumbnail_url}
            alt=""
            fill
            unoptimized
            className="object-cover"
            sizes="240px"
          />
        ) : null}
        {comp.distance_m != null ? (
          <span className="absolute left-2 top-2 bg-[#F2E3CF]/95 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#413532]">
            {formatDistanceMeters(comp.distance_m)} away
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col pt-2 text-[#15110f]">
        <p className="line-clamp-2 text-[10px] font-semibold leading-[1.12]">
          {comp.name}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-2 text-[8px] leading-none text-[#6F5D57]">
          <span>{comp.bedrooms ?? "—"} bed</span>
          <span>{comp.accommodates ?? "—"} guests</span>
          <span>{formatPercent(comp.occupancy_rate)} occupancy</span>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <p className="text-[13px] font-extrabold leading-none">
            {formatCurrency(comp.annual_revenue)}
            <span className="ml-1 text-[7px] font-medium text-[#6F5D57]">
              gross /yr
            </span>
          </p>
          <p className="shrink-0 text-[8px] font-semibold text-[#413532]">
            {formatCurrency(comp.nightly_rate)}/night
          </p>
        </div>
      </div>
    </article>
  );
}

function AgentSummary({ agent }: { agent: FinalReportJson["agents"][number] }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {agent.photo_url ? (
        <div className="relative h-[58px] w-[48px] shrink-0 overflow-hidden bg-[#D8CDC0]">
          <Image
            src={agent.photo_url}
            alt=""
            fill
            unoptimized
            className="object-cover object-top"
            sizes="48px"
          />
        </div>
      ) : null}
      <div className="min-w-0 text-[9px] leading-[1.3] text-[#413532]">
        <p className="text-[11px] font-semibold text-[#15110f]">{agent.name}</p>
        <p>{agent.role_title}</p>
        <p>{agent.phone}</p>
        <p className="break-all">{agent.email}</p>
      </div>
    </div>
  );
}

function MarketSnapshot({ report }: { report: FinalReportJson }) {
  const revenueRange = report.str_enrichment?.revenue_range;
  const annualRange =
    revenueRange?.p25 != null && revenueRange.p75 != null
      ? `${formatCurrency(revenueRange.p25)} – ${formatCurrency(revenueRange.p75)}`
      : "—";

  const metrics = [
    {
      label: "Estimated gross STR revenue",
      value: formatCurrency(report.str.annual_revenue),
    },
    {
      label: "Estimated annual range",
      value: annualRange,
    },
    {
      label: "Occupancy",
      value: formatPercent(report.str.occupancy_rate),
    },
    {
      label: "Nightly rate",
      value: `${formatCurrency(report.str.nightly_rate)}/night`,
    },
  ];

  return (
    <section
      data-testid="oc-str-market-snapshot"
      className="mt-auto shrink-0 border-t border-[#C0A591] pt-[10px]"
    >
      <h3
        className="text-[13px] font-semibold leading-none text-[#AB592A]"
        style={{ fontFamily: "var(--report-heading-font, inherit)" }}
      >
        Market snapshot
      </h3>
      <dl className="mt-[7px] grid h-[58px] grid-cols-[1.05fr_1.25fr_0.8fr_1fr] bg-[#AB592A] px-[14px] py-[10px] text-[#F2E3CF]">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={
              index === 0
                ? "min-w-0 pr-[12px]"
                : "min-w-0 border-l border-[#F2E3CF]/35 px-[12px] last:pr-0"
            }
          >
            <dt className="text-[7px] font-semibold uppercase leading-none tracking-[0.1em]">
              {metric.label}
            </dt>
            <dd
              className={`mt-[7px] whitespace-nowrap font-extrabold leading-none tracking-[-0.025em] ${
                index === 1 ? "text-[15px]" : "text-[16px]"
              }`}
              style={{ fontFamily: "var(--report-heading-font, inherit)" }}
            >
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function OcRealEstateStrPageTwo({
  report,
}: {
  report: FinalReportJson;
}) {
  const logo = report.agency.logo_dark_url || report.agency.logo_url;
  const comps = report.str_enrichment?.comps.slice(0, 6) ?? [];
  const seasonality = report.str_enrichment?.seasonality ?? [];

  return (
    <section
      data-testid="oc-str-page-two"
      className="report-page mx-auto flex flex-col overflow-hidden bg-[#F2E3CF] px-[34px] pb-[25px] pt-[28px] text-[#15110f]"
      style={{
        height: "var(--report-page-height, 297mm)",
        backgroundColor: OC_CREAM,
      }}
    >
      <header className="flex shrink-0 items-start justify-between gap-8">
        <div>
          <h2
            className="text-[34px] font-semibold leading-none tracking-[-0.025em]"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            Short-term rental market.
          </h2>
          <p className="mt-2 text-[11px] text-[#6F5D57]">
            Revenue and occupancy patterns near {report.property.suburb}.
          </p>
        </div>
        {logo ? (
          <div className="relative h-[42px] w-[82px] shrink-0">
            <Image
              src={logo}
              alt={report.agency.name}
              fill
              unoptimized
              className="object-contain object-right-top"
              sizes="82px"
            />
          </div>
        ) : null}
      </header>

      <section className="mt-[18px] grid shrink-0 grid-cols-2 gap-8 border-y border-[#C0A591] py-[12px]">
        <ClassicMonthlyRevenueChart
          report={report}
          compact
          chartColour={OC_ORANGE}
        />
        <ClassicSeasonalityChart
          seasonality={seasonality}
          compact
          chartColour={OC_ORANGE}
        />
      </section>

      <section className="mt-[14px] shrink-0">
        <div className="flex items-end justify-between gap-6">
          <h3
            className="text-[18px] leading-none"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            Comparable short stays.
          </h3>
          <p className="text-[9px] text-[#6F5D57]">
            {comps.length} selected · within {formatDistanceMeters(report.str.radius_m)}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-x-[14px] gap-y-[12px]">
          {comps.map((comp) => (
            <OcStrComparableCard key={comp.listing_id || comp.name} comp={comp} />
          ))}
        </div>
      </section>

      <section className="mt-[14px] grid shrink-0 grid-cols-[160px_minmax(0,1fr)] gap-8 border-t border-[#413532] pt-[11px]">
        <h3
          className="text-[18px] leading-[1.08]"
          style={{ fontFamily: "var(--report-heading-font, inherit)" }}
        >
          How we reached the estimate
        </h3>
        <div className="text-[9px] leading-[1.35] text-[#413532]">
          <ReportCopyTextField
            text={report.copy.methodology_note}
            path="copy.methodology_note"
          />
          <ReportCopyDisclaimer
            text={report.copy.disclaimer}
            className="mt-2 text-[7px] leading-[1.35] text-[#776963]"
          />
        </div>
      </section>

      <MarketSnapshot report={report} />

      <footer className="mt-[10px] grid shrink-0 grid-cols-2 gap-8 border-t border-[#C0A591] pt-[13px]">
        {report.agents.slice(0, 2).map((agent) => (
          <AgentSummary key={agent.email || agent.name} agent={agent} />
        ))}
      </footer>
    </section>
  );
}
