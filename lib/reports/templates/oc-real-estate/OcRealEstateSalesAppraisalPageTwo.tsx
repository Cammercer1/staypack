import Image from "next/image";
import { formatCurrency } from "@/lib/reports/formatters";
import { reportableSaleArea } from "@/lib/sales/reportableSaleArea";
import {
  ReportCopyComparableDisclaimer,
  ReportCopyComparableEvidence,
} from "@/components/reports/inline/ReportCopyFields";
import type { FinalReportJson, SaleCompCard } from "@/lib/types";

function comparablePrice(comp: SaleCompCard) {
  if (comp.price != null && comp.price > 0) {
    return formatCurrency(comp.price);
  }

  return comp.price_display?.trim() || "Price undisclosed";
}

function statusLabel(comp: SaleCompCard) {
  return comp.sale_status === "sold" ? "Sold" : "For sale";
}

function soldDateLabel(comp: SaleCompCard) {
  if (comp.sale_status !== "sold" || !comp.sold_date?.trim()) return null;
  const parsed = new Date(comp.sold_date);
  return Number.isNaN(parsed.getTime())
    ? comp.sold_date
    : parsed.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function OcComparableCard({ comp }: { comp: SaleCompCard }) {
  const soldDate = soldDateLabel(comp);
  const reportableArea = reportableSaleArea({
    propertyType: comp.property_type,
    landAreaSqm: comp.land_area_sqm,
    floorAreaSqm: comp.floor_area_sqm,
  });
  const area = reportableArea
    ? {
        label: reportableArea.kind === "land" ? "Land" : "Floor",
        value: reportableArea.value,
      }
    : null;

  return (
    <article className="flex h-[246px] min-w-0 flex-col overflow-hidden bg-[#F2E3CF]">
      <div className="relative h-[148px] shrink-0 overflow-hidden bg-[#D8CDC0]">
        {comp.thumbnail_url ? (
          <Image
            src={comp.thumbnail_url}
            alt=""
            fill
            unoptimized
            className="object-cover"
            sizes="350px"
          />
        ) : null}
        <span className="absolute left-3 top-3 bg-[#F2E3CF]/95 px-3 py-1.5 text-[12px] font-medium leading-none text-[#15110f]">
          {statusLabel(comp)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3.5 pb-3 pt-2">
        {comp.property_type || soldDate ? (
          <div className="mb-1.5 flex min-w-0 items-center gap-2 text-[8px] font-semibold uppercase leading-none tracking-[0.12em] text-[#776963]">
            {comp.property_type ? (
              <span className="truncate">{comp.property_type}</span>
            ) : null}
            {comp.property_type && soldDate ? (
              <span
                className="h-0.5 w-0.5 shrink-0 rounded-full bg-[#A88C78]"
                aria-hidden
              />
            ) : null}
            {soldDate ? <span className="shrink-0">Sold {soldDate}</span> : null}
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 min-w-0 text-[15px] font-semibold leading-[1.12] text-[#15110f]">
            {comp.name}
          </p>
          <dl
            className="shrink-0 space-y-1 text-[12px] leading-none text-[#15110f]"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            {comp.bedrooms != null ? (
              <div className="flex justify-between gap-2">
                <dt>Bed</dt>
                <dd className="font-semibold">{comp.bedrooms}</dd>
              </div>
            ) : null}
            {comp.bathrooms != null ? (
              <div className="flex justify-between gap-2">
                <dt>Bath</dt>
                <dd className="font-semibold">{comp.bathrooms}</dd>
              </div>
            ) : null}
            {comp.car_spaces != null ? (
              <div className="flex justify-between gap-2">
                <dt>Car</dt>
                <dd className="font-semibold">{comp.car_spaces}</dd>
              </div>
            ) : null}
            {area ? (
              <div className="flex justify-between gap-2">
                <dt>{area.label}</dt>
                <dd className="font-semibold">
                  {area.value.toLocaleString("en-AU")}m²
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <p className="mt-auto text-[15px] font-semibold leading-none text-[#15110f]">
          {comparablePrice(comp)}
        </p>
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

export function OcRealEstateSalesAppraisalPageTwo({
  report,
}: {
  report: FinalReportJson;
}) {
  const comps = report.sales_enrichment?.comps.slice(0, 6) ?? [];
  const logo = report.agency.logo_dark_url || report.agency.logo_url;

  return (
    <section
      data-testid="oc-specific-comparables-page"
      className="report-page mx-auto flex flex-col overflow-hidden bg-[#F2E3CF] px-[34px] pb-[25px] pt-[28px] text-[#15110f]"
      style={{
        height: "var(--report-page-height, 297mm)",
        backgroundColor: "#F2E3CF",
      }}
    >
      <header className="flex shrink-0 items-start justify-between gap-8">
        <h2
          className="text-[34px] font-semibold leading-none tracking-[-0.025em]"
          style={{ fontFamily: "var(--report-heading-font, inherit)" }}
        >
          Comparable sales.
        </h2>
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

      <div className="mt-[18px] grid shrink-0 grid-cols-2 gap-[12px]">
        {comps.map((comp) => (
          <OcComparableCard key={comp.listing_id || comp.name} comp={comp} />
        ))}
      </div>

      <section className="mt-[16px] grid shrink-0 grid-cols-[160px_minmax(0,1fr)] gap-8 border-t border-[#413532] pt-[14px]">
        <h3
          className="text-[18px] leading-[1.08]"
          style={{ fontFamily: "var(--report-heading-font, inherit)" }}
        >
          Comparable sale evidence
        </h3>
        <div className="text-[10px] leading-[1.35] text-[#413532]">
          <ReportCopyComparableEvidence text={report.copy.comparable_evidence} />
          {report.copy.comparable_disclaimer ? (
            <ReportCopyComparableDisclaimer
              text={report.copy.comparable_disclaimer}
              as="p"
              className="mt-2 text-[8px] leading-[1.35] text-[#776963]"
            />
          ) : null}
        </div>
      </section>

      <footer className="mt-auto grid shrink-0 grid-cols-2 gap-8 border-t border-[#C0A591] pt-[13px]">
        {report.agents.slice(0, 2).map((agent) => (
          <AgentSummary key={agent.email || agent.name} agent={agent} />
        ))}
      </footer>
    </section>
  );
}
