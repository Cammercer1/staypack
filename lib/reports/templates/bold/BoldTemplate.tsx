import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { formatNumber } from "@/lib/reports/formatters";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { resolveHeroGalleryImages } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import {
  ReportAgentBlock,
  resolveReportAgents,
  StrRevenueBlock,
} from "@/lib/reports/templates/shared/StrRevenueBlock";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import type { FinalReportJson } from "@/lib/types";

const headingFont = "var(--report-heading-font, inherit)";
const bodyFont = "var(--report-body-font, inherit)";

function BoldStatStrip({
  report,
  backgroundColor,
}: {
  report: FinalReportJson;
  backgroundColor?: string;
}) {
  const { property } = report;
  const accent =
    backgroundColor ?? report.agency.primary_colour ?? "#1a1a2e";

  const stats: { value: string; label: string }[] = [];
  if (property.bedrooms) stats.push({ value: formatNumber(property.bedrooms), label: "Bed" });
  if (property.bathrooms) stats.push({ value: formatNumber(property.bathrooms), label: "Bath" });
  if (property.car_spaces) stats.push({ value: formatNumber(property.car_spaces), label: "Car" });
  if (property.accommodates) stats.push({ value: formatNumber(property.accommodates), label: "Guests" });

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
          Short-Term Rental Report
        </p>
      ) : null}
    </div>
  );
}

export type BoldReportPageOneOptions = {
  /** Override logo URL (e.g. white-label templates with hardcoded assets). */
  logoUrl?: string;
  /** Footer logo img class — default inverts for generic agency marks. */
  footerLogoClassName?: string;
  /** Stat strip + footer band background. */
  accentColor?: string;
  /** Stronger hero gradient so white headline text reads on bright photos. */
  heroOverlayEnhanced?: boolean;
  agentPhotoClassName?: string;
  /** Revenue box uses accent fill with white type (Haven). */
  revenueOnAccent?: boolean;
  /** Hero subtitle under address; pass null to hide. */
  heroSubheadline?: string | null;
};

export function BoldReportPageOne({
  report,
  options,
}: {
  report: FinalReportJson;
  options?: BoldReportPageOneOptions;
}) {
  const brand = getReportBrandColours(report.agency);
  const { hero } = resolveHeroGalleryImages(report.property);
  const logoUrl = options?.logoUrl ?? getAgencyLogoUrl(report.agency, "dark");
  const footerLogoClassName =
    options?.footerLogoClassName ??
    "h-7 max-w-[130px] object-contain brightness-0 invert";
  const accent = options?.accentColor ?? report.agency.primary_colour ?? "#1a1a2e";
  const heroOverlayEnhanced = options?.heroOverlayEnhanced ?? false;
  const heroSubheadline =
    options?.heroSubheadline !== undefined
      ? options.heroSubheadline
      : report.copy.heading;
  const agents = resolveReportAgents(report).slice(0, 2);
  const features = [
    ...(report.copy.appeal_points ?? []),
    ...(report.copy.supporting_factors ?? []),
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 9);

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        height: "var(--report-page-height, 297mm)",
      }}
    >
      {/* Hero — ~140mm */}
      <div className="relative shrink-0 overflow-hidden" style={{ height: "140mm" }}>
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full bg-neutral-300" />
        )}
        {heroOverlayEnhanced ? (
          <div
            className="pointer-events-none absolute inset-0 bg-black/20"
            aria-hidden
          />
        ) : null}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent ${
            heroOverlayEnhanced ? "from-black/65" : "from-black/55"
          }`}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent ${
            heroOverlayEnhanced
              ? "h-56 from-black/90 via-black/55"
              : "h-48 from-black/80 via-black/40"
          }`}
          aria-hidden
        />
        {logoUrl ? (
          <div className="absolute left-7 top-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={report.agency.name}
              className="h-10 max-w-[160px] object-contain drop-shadow-md"
            />
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 px-8 pb-7">
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
          {heroSubheadline && heroSubheadline !== report.property.address ? (
            <p
              className="mt-2 text-[0.9rem] font-medium leading-snug text-white/90"
              style={{ fontFamily: headingFont }}
            >
              {heroSubheadline}
            </p>
          ) : null}
        </div>
      </div>

      <BoldStatStrip report={report} backgroundColor={accent} />

      {/* Body — two columns */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.45fr_1fr] gap-8 overflow-hidden px-8 py-6">
        {/* Left — blurb + bullets */}
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          {report.copy.blurb ? (
            <p
              className="text-[0.74rem] leading-[1.7] text-neutral-700"
              style={{ fontFamily: bodyFont }}
            >
              {report.copy.blurb}
            </p>
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
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Right — revenue + agents + QR */}
        <div className="flex min-h-0 flex-col justify-between gap-5 overflow-hidden">
          <StrRevenueBlock report={report} onAccent={options?.revenueOnAccent} />
          <div className="space-y-4">
            {agents.map((agent) => (
              <ReportAgentBlock
                key={agent.name || agent.email || agent.phone}
                agent={agent}
                accent={accent}
                photoClassName={options?.agentPhotoClassName}
              />
            ))}
          </div>
          {report.assets.qr_code_url ? (
            <div className="flex items-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={report.assets.qr_code_url} alt="QR" className="h-14 w-14 shrink-0" />
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

      {/* Footer band */}
      <footer
        className="flex shrink-0 items-center justify-between px-8 py-3"
        style={{ backgroundColor: accent }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={report.agency.name}
            className={footerLogoClassName}
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

export function BoldLightTemplate({ report }: ReportTemplateProps) {
  return <BoldReportPageOne report={report} />;
}

export function BoldDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <BoldReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
