import { Bath, BedDouble, Car } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { formatNumber } from "@/lib/reports/formatters";
import { resolveHeroGalleryImages } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import {
  ReportAgentBlock,
  resolveReportAgents,
} from "@/lib/reports/templates/shared/StrRevenueBlock";
import {
  formatRentCalloutSubline,
  rentCalloutFromReport,
} from "@/lib/lease-appraisal/formatRentCallout";
import {
  HAVEN_BRAND,
  HAVEN_LEASE_APPRAISAL_AGENT_PHOTO_CLASS,
} from "@/lib/reports/templates/haven-properties/brand";
import { ReportEditableImage } from "@/components/reports/inline/ReportEditableImage";
import { ReportCopyFeatureBullet } from "@/components/reports/inline/ReportCopyFeatureBullet";
import {
  ReportCopyBlurb,
  ReportCopyDisclaimer,
  ReportCopyHeading,
} from "@/components/reports/inline/ReportCopyFields";
import type { FinalReportJson } from "@/lib/types";

const headingFont = "var(--report-heading-font, inherit)";
const bodyFont = "var(--report-body-font, inherit)";

/** Shown in the teal bar only — body uses `copy.heading` from the listing / AI. */
export const LEASE_APPRAISAL_BANNER_LABEL = "Long-term rental appraisal";

function isDuplicateLeaseBannerHeading(heading: string) {
  const normalized = heading.trim().toLowerCase();
  return (
    normalized === LEASE_APPRAISAL_BANNER_LABEL.toLowerCase() ||
    normalized === "long-term rental appraisal"
  );
}

function HavenLeaseSpecStat({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon
        className="h-[1.125rem] w-[1.125rem] shrink-0 text-white"
        strokeWidth={1.5}
        aria-hidden
      />
      <span
        className="text-[1rem] font-semibold tabular-nums text-white"
        style={{ fontFamily: bodyFont }}
      >
        {value}
      </span>
    </div>
  );
}

function HavenLeaseStatsBanner({ report }: { report: FinalReportJson }) {
  const { property } = report;
  const accent = report.agency.primary_colour || HAVEN_BRAND.statBar;

  const stats: { id: string; icon: LucideIcon; value: string }[] = [];
  if (property.bedrooms) {
    stats.push({ id: "bed", icon: BedDouble, value: formatNumber(property.bedrooms) });
  }
  if (property.bathrooms) {
    stats.push({ id: "bath", icon: Bath, value: formatNumber(property.bathrooms) });
  }
  if (property.car_spaces) {
    stats.push({ id: "car", icon: Car, value: formatNumber(property.car_spaces) });
  }

  return (
    <div
      className="flex shrink-0 items-center justify-between px-8 py-4"
      style={{ backgroundColor: accent }}
    >
      <p className="text-[1rem] font-bold text-white" style={{ fontFamily: headingFont }}>
        {LEASE_APPRAISAL_BANNER_LABEL}
      </p>
      {stats.length > 0 ? (
        <div className="flex items-center gap-7">
          {stats.map((stat) => (
            <HavenLeaseSpecStat key={stat.id} icon={stat.icon} value={stat.value} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HavenLeaseAppraisalPageOne({ report }: { report: FinalReportJson }) {
  const brand = getReportBrandColours(report.agency);
  const { hero, secondary } = resolveHeroGalleryImages(report.property);
  const heroLogoUrl = HAVEN_BRAND.logoOnDarkUrl;
  const accent = report.agency.primary_colour || HAVEN_BRAND.statBar;
  const heroAddressLine = report.property.address?.trim() ?? "";
  const heroLocationLine = [
    report.property.suburb,
    report.property.state,
    report.property.postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const showHeroLocation =
    heroLocationLine &&
    !heroAddressLine.toLowerCase().includes(heroLocationLine.toLowerCase().slice(0, 12));
  const agents = resolveReportAgents(report).slice(0, 2);
  const rentAmount =
    report.ltr?.weekly_min != null && report.ltr?.weekly_max != null
      ? rentCalloutFromReport(report.ltr)
      : null;
  const rentSubline = formatRentCalloutSubline(report.ltr_enrichment?.comp_count);

  const appealPoints = report.copy.appeal_points ?? [];
  const supportingFactors = report.copy.supporting_factors ?? [];
  const features = [...appealPoints, ...supportingFactors]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 9);

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden bg-white shadow-sm"
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
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/25"
          aria-hidden
        />
        {heroLogoUrl ? (
          <div className="absolute left-6 top-5 z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroLogoUrl}
              alt={report.agency.name}
              className="h-8 max-w-[150px] object-contain object-left drop-shadow-md"
            />
          </div>
        ) : null}
        {heroAddressLine ? (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-6 pb-5 pt-10">
            <h1
              className="text-[1.25rem] font-bold leading-[1.2] text-white drop-shadow-sm"
              style={{ fontFamily: headingFont }}
            >
              {heroAddressLine}
            </h1>
            {showHeroLocation ? (
              <p
                className="mt-1 text-[0.8rem] font-medium text-white/90"
                style={{ fontFamily: bodyFont }}
              >
                {heroLocationLine}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <HavenLeaseStatsBanner report={report} />

      <div className="grid min-h-0 flex-1 grid-cols-[1.45fr_1fr] items-start gap-8 overflow-hidden px-8 py-6">
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          {report.copy.heading &&
          !isDuplicateLeaseBannerHeading(report.copy.heading) ? (
            <ReportCopyHeading
              text={report.copy.heading}
              as="h1"
              className="text-[1.1rem] font-bold leading-[1.2] text-neutral-900"
              style={{ fontFamily: headingFont }}
            />
          ) : null}

          {report.copy.blurb ? (
            <ReportCopyBlurb
              blurb={report.copy.blurb}
              paraClassName="text-[0.74rem] leading-[1.7] text-neutral-700"
              style={{ fontFamily: bodyFont }}
            />
          ) : null}

          {features.length > 0 ? (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {features.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-[0.7rem] leading-snug text-neutral-800"
                  style={{ fontFamily: bodyFont }}
                >
                  <span
                    className="mt-[0.3rem] h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  <ReportCopyFeatureBullet
                    item={item}
                    appealPoints={appealPoints}
                    supportingFactors={supportingFactors}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col justify-between gap-5 overflow-hidden">
          <div className="w-full shrink-0">
            {rentAmount ? (
              <div className="w-full p-4" style={{ backgroundColor: accent }}>
                <p
                  className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/85"
                  style={{ fontFamily: headingFont }}
                >
                  What you could lease it for
                </p>
                <p
                  className="mt-1.5 font-semibold leading-none tracking-tight text-white"
                  style={{ fontFamily: headingFont, fontSize: "2rem" }}
                >
                  {rentAmount}
                  <span className="text-[0.9rem] font-semibold text-white/85"> /wk</span>
                </p>
                <p
                  className="mt-2 border-t border-white/25 pt-2 text-[0.68rem] leading-[1.6] text-white/85"
                  style={{ fontFamily: bodyFont }}
                >
                  {rentSubline}
                </p>
              </div>
            ) : null}

            {agents.length > 0 ? (
              <div className="w-full space-y-5 pt-8">
                {agents.map((agent) => (
                  <ReportAgentBlock
                    key={agent.name || agent.email || agent.phone}
                    agent={agent}
                    accent={accent}
                    photoClassName={HAVEN_LEASE_APPRAISAL_AGENT_PHOTO_CLASS}
                    size="prominent"
                  />
                ))}
              </div>
            ) : agents.length === 0 && secondary.length > 0 ? (
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

          {report.copy.disclaimer ? (
            <ReportCopyDisclaimer
              text={report.copy.disclaimer}
              as="p"
              className="shrink-0 text-[0.56rem] leading-relaxed text-neutral-400"
              style={{ fontFamily: bodyFont }}
            />
          ) : null}
        </div>
      </div>

      <footer
        className="flex shrink-0 items-center justify-between px-8 py-3"
        style={{ backgroundColor: accent }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HAVEN_BRAND.logoOnDarkUrl}
          alt={report.agency.name}
          className="h-7 max-w-[160px] object-contain"
        />
        {report.agency.website_url ? (
          <p className="text-[0.65rem] text-white/70" style={{ fontFamily: bodyFont }}>
            {report.agency.website_url}
          </p>
        ) : null}
      </footer>
    </section>
  );
}
