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
const MINIMALIST_CREAM = "#f5f0e8";

function MinimalistSectionLabel({ children, accent }: { children: string; accent: string }) {
  return (
    <p
      className="text-[0.62rem] font-bold uppercase tracking-[0.06em]"
      style={{ color: accent, fontFamily: headingFont }}
    >
      {children}
    </p>
  );
}

export function MinimalistReportPageOne({ report }: { report: FinalReportJson }) {
  const { property, agency } = report;
  const brand = getReportBrandColours(agency);
  const pageBg = agency.background_colour?.trim() || MINIMALIST_CREAM;
  const accent = agency.primary_colour || "#5c2f2f";
  const logoUrl = getAgencyLogoUrl(agency, "light");

  const { hero, secondary } = resolveHeroGalleryImages(property);
  const gallery = [secondary[0] ?? hero, secondary[1] ?? secondary[0] ?? hero, secondary[2] ?? secondary[1] ?? secondary[0] ?? hero].filter(
    Boolean,
  );

  const agents = resolveReportAgents(report).slice(0, 1);
  const agent = agents[0];

  const features = [
    ...(report.copy.appeal_points ?? []),
    ...(report.copy.supporting_factors ?? []),
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 5);

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: pageBg,
        color: brand.text,
        height: "var(--report-page-height, 297mm)",
      }}
    >
      {/* Photo strip — top half */}
      <div className="flex shrink-0 flex-col px-8 pt-8" style={{ height: "50%" }}>
        <div className="flex min-h-0 flex-1 flex-col gap-[3px]">
          {hero ? (
            <div className="min-h-0 flex-[7] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="min-h-0 flex-[7] bg-neutral-300" />
          )}
          {gallery.length > 0 ? (
            <div className="grid min-h-0 flex-[3] grid-cols-3 gap-[3px]">
              {gallery.map((url, i) => (
                <div key={`${url}-${i}`} className="min-h-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Body — two columns */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.65fr_1fr] gap-8 overflow-hidden px-8 pb-8 pt-6">
        {/* Left — address + heading + blurb */}
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <p
            className="text-[0.76rem] font-medium text-neutral-900"
            style={{ fontFamily: bodyFont }}
          >
            {property.address}
          </p>

          {report.copy.heading && report.copy.heading !== property.address ? (
            <h1
              className="text-[1.35rem] font-bold leading-[1.12]"
              style={{ color: accent, fontFamily: headingFont }}
            >
              {report.copy.heading}
            </h1>
          ) : null}

          {report.copy.blurb ? (
            <p
              className="text-[0.74rem] leading-[1.72] text-neutral-800"
              style={{ fontFamily: bodyFont }}
            >
              {report.copy.blurb}
            </p>
          ) : null}

          {report.copy.disclaimer ? (
            <p
              className="mt-auto pt-4 text-[0.56rem] leading-relaxed text-neutral-400"
              style={{ fontFamily: bodyFont }}
            >
              {report.copy.disclaimer}
            </p>
          ) : null}
        </div>

        {/* Right — stats + STR revenue + agent + logo */}
        <aside className="flex min-h-0 flex-col gap-5 overflow-hidden">
          <div className="space-y-1.5">
            <MinimalistSectionLabel accent={accent}>Property</MinimalistSectionLabel>
            <div className="flex flex-wrap gap-4">
              {property.bedrooms ? (
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-[1rem] font-semibold text-neutral-900"
                    style={{ fontFamily: bodyFont }}
                  >
                    {formatNumber(property.bedrooms)}
                  </span>
                  <span className="text-[0.65rem] text-neutral-500">bed</span>
                </div>
              ) : null}
              {property.bathrooms ? (
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-[1rem] font-semibold text-neutral-900"
                    style={{ fontFamily: bodyFont }}
                  >
                    {formatNumber(property.bathrooms)}
                  </span>
                  <span className="text-[0.65rem] text-neutral-500">bath</span>
                </div>
              ) : null}
              {property.accommodates ? (
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-[1rem] font-semibold text-neutral-900"
                    style={{ fontFamily: bodyFont }}
                  >
                    {formatNumber(property.accommodates)}
                  </span>
                  <span className="text-[0.65rem] text-neutral-500">guests</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <MinimalistSectionLabel accent={accent}>STR Revenue</MinimalistSectionLabel>
            <StrRevenueBlock report={report} compact />
          </div>

          {features.length > 0 ? (
            <div className="space-y-1.5">
              <MinimalistSectionLabel accent={accent}>Highlights</MinimalistSectionLabel>
              <ul className="space-y-1">
                {features.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[0.7rem] leading-snug text-neutral-700"
                    style={{ fontFamily: bodyFont }}
                  >
                    <span
                      className="mt-[0.3rem] h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {agent ? (
            <div className="space-y-0.5">
              <MinimalistSectionLabel accent={accent}>Agent</MinimalistSectionLabel>
              {agent.name ? (
                <p
                  className="text-[0.74rem] font-semibold text-neutral-900"
                  style={{ fontFamily: bodyFont }}
                >
                  {agent.name}
                </p>
              ) : null}
              {agent.phone ? (
                <p className="text-[0.72rem] text-neutral-700">{agent.phone}</p>
              ) : null}
              {agent.email ? (
                <p className="break-all text-[0.68rem] text-neutral-600">{agent.email}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-auto flex items-center justify-between pt-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={agency.name}
                className="h-9 max-w-[130px] object-contain object-left"
              />
            ) : null}
            {report.assets.qr_code_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={report.assets.qr_code_url} alt="QR" className="h-10 w-10 shrink-0" />
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

export function MinimalistLightTemplate({ report }: ReportTemplateProps) {
  return <MinimalistReportPageOne report={report} />;
}

export function MinimalistDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <MinimalistReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
