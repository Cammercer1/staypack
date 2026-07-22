import { formatNumber } from "@/lib/reports/formatters";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { resolveHeroGalleryImages } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import {
  HAVEN_AGENT_PHOTO_CLASS,
  HAVEN_BRAND,
} from "@/lib/reports/templates/haven-properties/brand";
import {
  ReportAgentBlock,
  resolveReportAgents,
  StrRevenueBlock,
} from "@/lib/reports/templates/shared/StrRevenueBlock";
import { ReportEditableImage } from "@/components/reports/inline/ReportEditableImage";
import {
  ReportCopyAppealPoint,
  ReportCopyBlurb,
  ReportCopySupportingFactor,
} from "@/components/reports/inline/ReportCopyFields";
import type { FinalReportJson } from "@/lib/types";

const headingFont = "var(--report-heading-font, inherit)";
const bodyFont = "var(--report-body-font, inherit)";

export const HAVEN_STR_PAGE_ONE_BULLET_COUNT = 6;

function HavenStrStatStrip({ report }: { report: FinalReportJson }) {
  const { property } = report;
  const accent = report.agency.primary_colour || HAVEN_BRAND.statBar;

  const stats: { value: string; label: string }[] = [];
  if (property.bedrooms) stats.push({ value: formatNumber(property.bedrooms), label: "Bed" });
  if (property.bathrooms) stats.push({ value: formatNumber(property.bathrooms), label: "Bath" });
  if (property.car_spaces) stats.push({ value: formatNumber(property.car_spaces), label: "Car" });
  if (property.accommodates) {
    stats.push({ value: formatNumber(property.accommodates), label: "Guests" });
  }

  return (
    <div
      className="flex shrink-0 items-center justify-between px-8 py-3.5"
      style={{ backgroundColor: accent }}
    >
      <div className="flex items-center gap-8">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5">
            <span
              className="text-[1.05rem] font-bold leading-none text-white"
              style={{ fontFamily: bodyFont }}
            >
              {s.value}
            </span>
            <span
              className="text-[0.62rem] font-medium uppercase tracking-[0.08em] text-white/70"
              style={{ fontFamily: headingFont }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
      {report.str.annual_revenue ? (
        <p
          className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-white/80"
          style={{ fontFamily: headingFont }}
        >
          Short-term rental appraisal
        </p>
      ) : null}
    </div>
  );
}

/** Haven STR page 1 — hero, stat strip, blurb + revenue callout + agents. */
export function HavenStrPageOne({ report }: { report: FinalReportJson }) {
  const brand = getReportBrandColours(report.agency);
  const { hero, secondary } = resolveHeroGalleryImages(report.property);
  const logoUrl = HAVEN_BRAND.logoOnDarkUrl;
  const accent = report.agency.primary_colour || HAVEN_BRAND.statBar;
  const agents = resolveReportAgents(report).slice(0, 2);
  const appealPoints = report.copy.appeal_points ?? [];
  const supportingFactors = report.copy.supporting_factors ?? [];
  const features = [...appealPoints, ...supportingFactors]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, HAVEN_STR_PAGE_ONE_BULLET_COUNT);

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        height: "var(--report-page-height, 297mm)",
      }}
    >
      <div className="relative shrink-0 overflow-hidden" style={{ height: "125mm" }}>
        {hero ? (
          <ReportEditableImage
            slot="hero"
            src={hero}
            className="h-full w-full"
            imgClassName="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full bg-neutral-300" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-black/20" aria-hidden />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/65 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/90 via-black/55 to-transparent"
          aria-hidden
        />
        {logoUrl ? (
          <div className="pointer-events-none absolute left-7 top-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={report.agency.name}
              className="h-10 max-w-[160px] object-contain drop-shadow-md"
            />
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-8 pb-7">
          <p
            className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/75"
            style={{ fontFamily: headingFont }}
          >
            {[report.property.suburb, report.property.state, report.property.postcode]
              .filter(Boolean)
              .join(", ")}
          </p>
          <h1
            className="mt-1.5 text-[1.75rem] font-bold leading-[1.1] text-white"
            style={{ fontFamily: headingFont }}
          >
            {report.property.address}
          </h1>
          {HAVEN_BRAND.heroSubheadline ? (
            <p
              className="mt-2 text-[0.9rem] font-medium leading-snug text-white/90"
              style={{ fontFamily: headingFont }}
            >
              {HAVEN_BRAND.heroSubheadline}
            </p>
          ) : null}
        </div>
      </div>

      <HavenStrStatStrip report={report} />

      <div className="grid min-h-0 flex-1 grid-cols-[1.45fr_1fr] gap-8 px-8 pt-5 pb-4">
        <div className="flex min-h-0 flex-col gap-3">
          {report.copy.blurb ? (
            <ReportCopyBlurb
              blurb={report.copy.blurb}
              paraClassName="text-[0.74rem] leading-[1.7] text-neutral-700"
              style={{ fontFamily: bodyFont }}
            />
          ) : null}
          {features.length > 0 ? (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {features.map((item) => {
                const appealIndex = appealPoints.indexOf(item);
                const supportingIndex =
                  appealIndex >= 0 ? -1 : supportingFactors.indexOf(item);
                return (
                  <li
                    key={item}
                    className="flex gap-2 text-[0.7rem] leading-snug text-neutral-800"
                    style={{ fontFamily: bodyFont }}
                  >
                    <span
                      className="mt-[0.3rem] h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    {appealIndex >= 0 ? (
                      <ReportCopyAppealPoint index={appealIndex} text={item} as="span" />
                    ) : supportingIndex >= 0 ? (
                      <ReportCopySupportingFactor
                        index={supportingIndex}
                        text={item}
                        as="span"
                      />
                    ) : (
                      <span>{item}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <StrRevenueBlock report={report} onAccent />
          <div className="space-y-3">
            {agents.map((agent) => (
              <ReportAgentBlock
                key={agent.name || agent.email || agent.phone}
                agent={agent}
                accent={accent}
                photoClassName={HAVEN_AGENT_PHOTO_CLASS}
                size="prominent"
              />
            ))}
          </div>
          {agents.length === 0 && secondary.length > 0 ? (
            <div className="w-full shrink-0 overflow-hidden" style={{ height: "52mm" }}>
              <ReportEditableImage
                slot={{ kind: "secondary", index: secondary.length - 1 }}
                src={secondary[secondary.length - 1]!}
                className="h-full w-full"
                imgClassName="h-full w-full object-cover"
              />
            </div>
          ) : null}
        </div>
      </div>

      {report.copy.disclaimer ? (
        <p
          className="shrink-0 px-8 pb-3 text-[0.56rem] leading-relaxed text-neutral-400"
          style={{ fontFamily: bodyFont }}
        >
          {report.copy.disclaimer}
        </p>
      ) : null}

      <footer
        className="flex shrink-0 items-center justify-between px-8 py-3"
        style={{ backgroundColor: accent }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={report.agency.name}
            className="h-7 max-w-[160px] object-contain"
          />
        ) : (
          <p
            className="text-sm font-bold uppercase tracking-[0.14em] text-white"
            style={{ fontFamily: headingFont }}
          >
            {report.agency.name}
          </p>
        )}
        {report.agency.website_url ? (
          <p className="text-[0.65rem] text-white/70" style={{ fontFamily: bodyFont }}>
            {report.agency.website_url}
          </p>
        ) : null}
      </footer>
    </section>
  );
}
