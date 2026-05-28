import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { formatNumber } from "@/lib/reports/formatters";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { resolveHeroGalleryImages } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import {
  resolveReportAgents,
  StrRevenueBlock,
} from "@/lib/reports/templates/shared/StrRevenueBlock";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import type { FinalReportJson } from "@/lib/types";

const headingFont = "var(--report-heading-font, inherit)";
const bodyFont = "var(--report-body-font, inherit)";

function formatSpecsLine(report: FinalReportJson) {
  const { property } = report;
  const parts: string[] = [];
  if (property.bedrooms) parts.push(`${formatNumber(property.bedrooms)} BEDS`);
  if (property.bathrooms) parts.push(`${formatNumber(property.bathrooms)} BATHS`);
  if (property.accommodates) parts.push(`${formatNumber(property.accommodates)} GUESTS`);
  return parts.join("  |  ");
}

export function RefinedReportPageOne({ report }: { report: FinalReportJson }) {
  const brand = getReportBrandColours(report.agency);
  const { hero, secondary } = resolveHeroGalleryImages(report.property);
  const footerPhoto = secondary[1] ?? secondary[0] ?? hero;
  const logoUrl = getAgencyLogoUrl(report.agency, "dark");
  const accent = report.agency.primary_colour || "#1a1a2e";
  const agents = resolveReportAgents(report).slice(0, 1);
  const agent = agents[0];

  const features = [
    ...(report.copy.appeal_points ?? []),
    ...(report.copy.supporting_factors ?? []),
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 6);

  const specs = formatSpecsLine(report);

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        height: "var(--report-page-height, 297mm)",
      }}
    >
      {/* Branded header */}
      <header
        className="shrink-0 px-10 pb-6 pt-9 text-white"
        style={{ backgroundColor: accent }}
      >
        <p
          className="text-[0.65rem] font-medium uppercase tracking-[0.28em] text-white/75"
          style={{ fontFamily: headingFont }}
        >
          Short-Term Rental Potential
        </p>
        <div className="mt-3 flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h1
              className="text-[1.75rem] font-bold uppercase leading-tight tracking-tight text-white"
              style={{ fontFamily: headingFont }}
            >
              {report.property.address}
            </h1>
            <div className="mt-2 h-px w-full max-w-[280px] bg-white/40" />
            {specs ? (
              <p
                className="mt-3 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-white/90"
                style={{ fontFamily: bodyFont }}
              >
                {specs}
              </p>
            ) : null}
          </div>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={report.agency.name}
              className="h-11 max-w-[160px] shrink-0 object-contain object-right"
            />
          ) : null}
        </div>
      </header>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.05fr_0.95fr] gap-6 overflow-hidden px-10 pb-5 pt-10">
        {/* Left — blurb + features */}
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          {report.copy.blurb
            ? report.copy.blurb.split(/\n\n+/).map((para) => (
                <p
                  key={para.slice(0, 48)}
                  className="text-[0.76rem] leading-[1.65] text-neutral-700"
                  style={{ fontFamily: bodyFont }}
                >
                  {para.trim()}
                </p>
              ))
            : null}

          {features.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <h2
                className="text-[1rem] font-bold uppercase tracking-wide text-neutral-900"
                style={{ fontFamily: headingFont }}
              >
                Key features
              </h2>
              <ul className="mt-2 space-y-1.5">
                {features.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[0.72rem] leading-snug text-neutral-700"
                    style={{ fontFamily: bodyFont }}
                  >
                    <span className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-neutral-800" />
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Right — revenue box + agent */}
        <div className="flex min-h-0 flex-col gap-5 overflow-hidden">
          <StrRevenueBlock report={report} />

          {agent ? (
            <div className="flex items-center gap-3 border-t border-neutral-200 pt-4">
              {agent.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agent.photo_url}
                  alt={agent.name || "Agent"}
                  className="h-14 w-14 shrink-0 rounded-full object-cover object-top"
                />
              ) : null}
              <div className="min-w-0">
                {agent.name ? (
                  <p
                    className="text-[0.82rem] font-bold text-neutral-900"
                    style={{ fontFamily: headingFont }}
                  >
                    {agent.name}
                  </p>
                ) : null}
                {agent.role_title ? (
                  <p className="text-[0.7rem] text-neutral-500">{agent.role_title}</p>
                ) : null}
                {agent.phone ? (
                  <p className="text-[0.7rem] text-neutral-700">{agent.phone}</p>
                ) : null}
                {agent.email ? (
                  <p className="truncate text-[0.68rem] text-neutral-500">{agent.email}</p>
                ) : null}
              </div>
              {report.assets.qr_code_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={report.assets.qr_code_url}
                  alt="QR"
                  className="ml-auto h-12 w-12 shrink-0"
                />
              ) : null}
            </div>
          ) : null}

          {report.copy.cta ? (
            <p
              className="mt-auto shrink-0 text-center text-[0.65rem] font-medium uppercase tracking-[0.12em] text-neutral-500"
              style={{ fontFamily: headingFont }}
            >
              {report.copy.cta}
            </p>
          ) : null}
        </div>
      </div>

      {/* Footer photo */}
      {footerPhoto ? (
        <div className="h-[88mm] shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={footerPhoto} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
    </section>
  );
}

export function RefinedLightTemplate({ report }: ReportTemplateProps) {
  return <RefinedReportPageOne report={report} />;
}

export function RefinedDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <RefinedReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
