import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { formatCurrency, formatNumber } from "@/lib/reports/formatters";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { resolveHeroGalleryImages } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import {
  resolveReportAgents,
  StrStatRow,
} from "@/lib/reports/templates/shared/StrRevenueBlock";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import type { FinalReportJson } from "@/lib/types";

const headingFont = "var(--report-heading-font, inherit)";
const bodyFont = "var(--report-body-font, inherit)";

export function EditorialReportPageOne({ report }: { report: FinalReportJson }) {
  const brand = getReportBrandColours(report.agency);
  const { hero, secondary } = resolveHeroGalleryImages(report.property);
  const logoUrl = getAgencyLogoUrl(report.agency, "dark");
  const accent = report.agency.primary_colour || "#1a1a2e";
  const sideStack = secondary.slice(0, 2);
  const agents = resolveReportAgents(report).slice(0, 1);
  const agent = agents[0];

  const highlights = [
    ...(report.copy.appeal_points ?? []),
    ...(report.copy.supporting_factors ?? []),
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 5);

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        height: "var(--report-page-height, 297mm)",
      }}
    >
      {/* Hero mosaic — ~56% of page */}
      <div
        className="relative grid shrink-0 grid-cols-[1.35fr_0.65fr] gap-[3px] bg-neutral-900"
        style={{ height: "164mm" }}
      >
        {/* Top gradient scrim */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/50 to-transparent"
          aria-hidden
        />
        {/* Bottom gradient scrim */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-black/75 to-transparent"
          aria-hidden
        />

        {/* Logo */}
        {logoUrl ? (
          <div className="absolute left-8 top-6 z-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={report.agency.name}
              className="h-9 max-w-[160px] object-contain drop-shadow-md"
            />
          </div>
        ) : null}

        {hero ? (
          <div className="relative min-h-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div />
        )}

        <div className="grid min-h-0 grid-rows-2 gap-[3px]">
          {sideStack.map((url) => (
            <div key={url} className="min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>

        {/* Overlay text */}
        <div className="absolute inset-x-0 bottom-0 z-20 px-8 pb-6">
          <p
            className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-white/70"
            style={{ fontFamily: headingFont }}
          >
            {[report.property.suburb, report.property.state].filter(Boolean).join(", ")}
          </p>
          <h1
            className="mt-1.5 text-[1.6rem] font-bold leading-tight text-white"
            style={{ fontFamily: headingFont }}
          >
            {report.property.address}
          </h1>
          {report.str.annual_revenue ? (
            <div
              className="mt-3 inline-flex items-baseline gap-2 rounded-sm px-3 py-1.5"
              style={{ backgroundColor: `${accent}cc` }}
            >
              <span
                className="text-[1.1rem] font-bold text-white"
                style={{ fontFamily: headingFont }}
              >
                {formatCurrency(report.str.annual_revenue)}
              </span>
              <span className="text-[0.62rem] font-medium uppercase tracking-[0.1em] text-white/80">
                est. annual STR
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Content section */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_0.9fr] gap-8 overflow-hidden px-10 py-5">
        {/* Left — blurb + highlights */}
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          {report.copy.blurb ? (
            <p
              className="text-[0.76rem] leading-[1.65] text-neutral-700"
              style={{ fontFamily: bodyFont }}
            >
              {report.copy.blurb}
            </p>
          ) : null}
          {highlights.length > 0 ? (
            <ol className="space-y-2">
              {highlights.map((item, i) => (
                <li
                  key={item}
                  className="flex gap-3 text-[0.72rem] leading-snug text-neutral-700"
                  style={{ fontFamily: bodyFont }}
                >
                  <span
                    className="shrink-0 text-[0.7rem] font-bold"
                    style={{ color: accent, fontFamily: headingFont }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        {/* Right — stats + agent */}
        <div className="flex min-h-0 flex-col gap-5 overflow-hidden">
          <div className="space-y-1.5">
            <p
              className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-neutral-500"
              style={{ fontFamily: headingFont }}
            >
              Property
            </p>
            <div className="flex gap-5 text-[0.78rem] text-neutral-800">
              {report.property.bedrooms ? (
                <span><strong>{formatNumber(report.property.bedrooms)}</strong> bed</span>
              ) : null}
              {report.property.bathrooms ? (
                <span><strong>{formatNumber(report.property.bathrooms)}</strong> bath</span>
              ) : null}
              {report.property.accommodates ? (
                <span><strong>{formatNumber(report.property.accommodates)}</strong> guests</span>
              ) : null}
            </div>
          </div>

          <StrStatRow report={report} />

          {agent ? (
            <div className="mt-auto flex items-center gap-3 border-t border-neutral-200 pt-4">
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

          {report.copy.disclaimer ? (
            <p
              className="text-[0.56rem] leading-relaxed text-neutral-400"
              style={{ fontFamily: bodyFont }}
            >
              {report.copy.disclaimer}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function EditorialLightTemplate({ report }: ReportTemplateProps) {
  return <EditorialReportPageOne report={report} />;
}

export function EditorialDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <EditorialReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
