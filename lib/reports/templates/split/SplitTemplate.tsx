import { Bath, BedDouble, Car, Users } from "lucide-react";
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

export function SplitReportPageOne({ report }: { report: FinalReportJson }) {
  const brand = getReportBrandColours(report.agency);
  const { hero, secondary } = resolveHeroGalleryImages(report.property);
  const logoUrl = getAgencyLogoUrl(report.agency, "light");
  const accent = report.agency.primary_colour || "#1f2937";
  const agents = resolveReportAgents(report).slice(0, 1);
  const agent = agents[0];

  const photos = [hero, ...secondary].filter(Boolean).slice(0, 4);
  while (photos.length < 4 && photos.length > 0) photos.push(photos[photos.length - 1]);

  const stats: { label: string; value: string }[] = [];
  if (report.property.bedrooms)
    stats.push({ label: "Beds", value: formatNumber(report.property.bedrooms) });
  if (report.property.bathrooms)
    stats.push({ label: "Bath", value: formatNumber(report.property.bathrooms) });
  if (report.property.car_spaces)
    stats.push({ label: "Car", value: formatNumber(report.property.car_spaces) });
  if (report.property.accommodates)
    stats.push({ label: "Guests", value: formatNumber(report.property.accommodates) });

  return (
    <section
      className="report-page mx-auto grid grid-cols-[0.42fr_0.58fr] overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        height: "var(--report-page-height, 297mm)",
      }}
    >
      {/* Left — content column */}
      <div
        className="flex min-h-0 flex-col overflow-hidden px-8 py-8"
        style={{ borderRight: `3px solid ${accent}` }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={report.agency.name}
            className="mb-5 h-9 max-w-[140px] shrink-0 object-contain object-left"
          />
        ) : (
          <p
            className="mb-5 shrink-0 text-sm font-bold uppercase tracking-wide"
            style={{ color: accent, fontFamily: headingFont }}
          >
            {report.agency.name}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          <h1
            className="text-[1.2rem] font-bold leading-[1.2]"
            style={{ color: accent, fontFamily: headingFont }}
          >
            {report.property.address}
          </h1>

          {report.copy.heading && report.copy.heading !== report.property.address ? (
            <p
              className="mt-2 text-[0.8rem] font-semibold leading-snug text-neutral-800"
              style={{ fontFamily: headingFont }}
            >
              {report.copy.heading}
            </p>
          ) : null}

          {/* Divider */}
          <div className="my-4 h-px w-full" style={{ backgroundColor: `${accent}44` }} />

          {stats.length > 0 ? (
            <div className="mb-4 flex shrink-0 flex-wrap gap-4">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span
                    className="text-[1rem] font-bold text-neutral-900"
                    style={{ fontFamily: bodyFont }}
                  >
                    {s.value}
                  </span>
                  <span
                    className="text-[0.62rem] font-medium uppercase tracking-wide text-neutral-500"
                    style={{ fontFamily: headingFont }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {report.copy.blurb ? (
            <p
              className="line-clamp-6 text-[0.72rem] leading-[1.65] text-neutral-700"
              style={{ fontFamily: bodyFont }}
            >
              {report.copy.blurb}
            </p>
          ) : null}
        </div>

        {/* STR Revenue */}
        <div className="mt-4 shrink-0">
          <StrRevenueBlock report={report} compact />
        </div>

        {/* Agent */}
        {agent ? (
          <div className="mt-4 shrink-0 border-t border-neutral-200 pt-4">
            <div className="flex items-center gap-3">
              {agent.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agent.photo_url}
                  alt={agent.name || "Agent"}
                  className="h-12 w-12 shrink-0 rounded-full object-cover object-top"
                />
              ) : null}
              <div className="min-w-0">
                {agent.name ? (
                  <p
                    className="text-[0.78rem] font-bold text-neutral-900"
                    style={{ fontFamily: headingFont }}
                  >
                    {agent.name}
                  </p>
                ) : null}
                {agent.phone ? (
                  <p className="text-[0.7rem] text-neutral-700">{agent.phone}</p>
                ) : null}
                {agent.email ? (
                  <p className="truncate text-[0.65rem] text-neutral-500">{agent.email}</p>
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
          </div>
        ) : null}

        {report.copy.disclaimer ? (
          <p
            className="mt-3 shrink-0 text-[0.54rem] leading-relaxed text-neutral-400"
            style={{ fontFamily: bodyFont }}
          >
            {report.copy.disclaimer}
          </p>
        ) : null}
      </div>

      {/* Right — 2×2 photo grid */}
      <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-[3px] overflow-hidden bg-neutral-900">
        {photos.map((url, i) => (
          <div key={`${url}-${i}`} className="min-h-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SplitLightTemplate({ report }: ReportTemplateProps) {
  return <SplitReportPageOne report={report} />;
}

export function SplitDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <SplitReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
