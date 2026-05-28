import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { formatCurrency, formatNumber } from "@/lib/reports/formatters";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { resolveHeroGalleryImages } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import { resolveReportAgents } from "@/lib/reports/templates/shared/StrRevenueBlock";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import type { FinalReportJson } from "@/lib/types";

const headingFont = "var(--report-heading-font, inherit)";
const bodyFont = "var(--report-body-font, inherit)";

function LandmarkStatsBanner({ report }: { report: FinalReportJson }) {
  const { property } = report;
  const accent = report.agency.primary_colour || "#1a1a2e";

  const stats: { icon: string; value: string }[] = [];
  if (property.bedrooms) stats.push({ icon: "🛏", value: formatNumber(property.bedrooms) });
  if (property.bathrooms) stats.push({ icon: "🚿", value: formatNumber(property.bathrooms) });
  if (property.accommodates) stats.push({ icon: "👥", value: `${formatNumber(property.accommodates)} guests` });

  return (
    <div
      className="flex shrink-0 items-center justify-between px-8 py-4"
      style={{ backgroundColor: accent }}
    >
      <p className="text-[1rem] font-bold text-white" style={{ fontFamily: headingFont }}>
        STR Revenue Report
      </p>
      {stats.length > 0 ? (
        <div className="flex items-center gap-7">
          {stats.map((s) => (
            <div key={s.icon} className="flex items-center gap-2">
              <span className="text-[0.9rem] text-white/80">{s.icon}</span>
              <span
                className="text-[1rem] font-semibold text-white"
                style={{ fontFamily: bodyFont }}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LandmarkSectionLabel({ children, accent }: { children: string; accent: string }) {
  return (
    <p
      className="text-[0.6rem] font-bold uppercase tracking-[0.1em]"
      style={{ color: accent, fontFamily: headingFont }}
    >
      {children}
    </p>
  );
}

export function LandmarkReportPageOne({ report }: { report: FinalReportJson }) {
  const brand = getReportBrandColours(report.agency);
  const { hero, secondary } = resolveHeroGalleryImages(report.property);
  const logoUrl = getAgencyLogoUrl(report.agency, "light");
  const accent = report.agency.primary_colour || "#c0392b";
  const agents = resolveReportAgents(report);
  const allAgents = agents.length ? agents : [report.agent];

  const bullets = [
    ...(report.copy.appeal_points ?? []),
    ...(report.copy.supporting_factors ?? []),
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 5);

  const agentPhotos = allAgents
    .filter((a) => a.photo_url)
    .slice(0, 2);

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden bg-white shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        height: "var(--report-page-height, 297mm)",
      }}
    >
      {/* Hero — ~42% of page */}
      <div className="relative shrink-0 overflow-hidden" style={{ height: "125mm" }}>
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full bg-neutral-300" />
        )}
        {logoUrl ? (
          <div className="absolute bottom-4 right-5 flex items-center gap-2 rounded bg-white/20 px-3 py-1.5 backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={report.agency.name}
              className="h-6 max-w-[110px] object-contain brightness-0 invert drop-shadow"
            />
          </div>
        ) : null}
      </div>

      <LandmarkStatsBanner report={report} />

      {/* Two-column body */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_0.9fr] gap-0 overflow-hidden">
        {/* Left */}
        <div className="min-h-0 overflow-hidden border-r border-neutral-200 px-8 py-6">
          <div className="flex h-full flex-col overflow-hidden">
            {report.copy.heading && report.copy.heading !== report.property.address ? (
              <h1
                className="mb-3 text-[1.1rem] font-bold leading-[1.2] text-neutral-900"
                style={{ fontFamily: headingFont }}
              >
                {report.copy.heading}
              </h1>
            ) : null}

            <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden">
              {report.copy.blurb
                ? report.copy.blurb.split(/\n\n+/).map((para) => (
                    <p
                      key={para.slice(0, 48)}
                      className="text-[0.7rem] leading-[1.68] text-neutral-700"
                      style={{ fontFamily: bodyFont }}
                    >
                      {para.trim()}
                    </p>
                  ))
                : null}

              {bullets.length > 0 ? (
                <ul className="space-y-1.5 pt-1">
                  {bullets.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-[0.7rem] leading-snug text-neutral-700"
                      style={{ fontFamily: bodyFont }}
                    >
                      <span
                        className="mt-[0.3rem] h-[5px] w-[5px] shrink-0 rounded-full bg-neutral-500"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="mt-auto shrink-0 pt-3">
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={report.agency.name}
                    className="h-9 max-w-[160px] object-contain object-left"
                  />
                ) : null}
                {report.assets.qr_code_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={report.assets.qr_code_url}
                    alt="QR"
                    className="h-10 w-10 shrink-0"
                  />
                ) : null}
              </div>
              {report.copy.disclaimer ? (
                <p
                  className="mt-1.5 text-[0.56rem] leading-relaxed text-neutral-400"
                  style={{ fontFamily: bodyFont }}
                >
                  {report.copy.disclaimer}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden px-6 py-6">
          {report.str.annual_revenue ? (
            <div className="space-y-1">
              <LandmarkSectionLabel accent={accent}>Estimated Annual STR Revenue</LandmarkSectionLabel>
              <p
                className="text-[1.75rem] font-bold leading-none"
                style={{ color: accent, fontFamily: headingFont }}
              >
                {formatCurrency(report.str.annual_revenue)}
              </p>
              <p className="text-[0.65rem] text-neutral-500" style={{ fontFamily: bodyFont }}>
                gross before costs
              </p>
              {report.copy.key_metrics_line ? (
                <p
                  className="pt-2 text-[0.68rem] leading-[1.6] text-neutral-600"
                  style={{ fontFamily: bodyFont }}
                >
                  {report.copy.key_metrics_line}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <LandmarkSectionLabel accent={accent}>Address</LandmarkSectionLabel>
            <p
              className="text-[0.74rem] leading-snug text-neutral-800"
              style={{ fontFamily: bodyFont }}
            >
              {[
                report.property.address,
                [report.property.suburb, report.property.state, report.property.postcode]
                  .filter(Boolean)
                  .join(", "),
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>

          <div className="space-y-2">
            <LandmarkSectionLabel accent={accent}>Agents</LandmarkSectionLabel>
            <div className="space-y-3">
              {allAgents.map((a) => (
                <div key={a.name || a.email} className="space-y-0.5">
                  {(a.name || a.phone) ? (
                    <p
                      className="text-[0.74rem] font-semibold text-neutral-900"
                      style={{ fontFamily: bodyFont }}
                    >
                      {[a.name, a.phone].filter(Boolean).join(" – ")}
                    </p>
                  ) : null}
                  {a.email ? (
                    <p
                      className="break-all text-[0.68rem] text-neutral-600"
                      style={{ fontFamily: bodyFont }}
                    >
                      {a.email}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {agentPhotos.length > 0 ? (
            <div className="mt-auto flex shrink-0 justify-end gap-2 pt-2">
              {agentPhotos.map((a) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.name || a.email}
                  src={a.photo_url!}
                  alt={a.name || "Agent"}
                  className="h-[52mm] w-[42mm] object-cover object-top"
                />
              ))}
            </div>
          ) : (
            agentPhotos.length === 0 && secondary.length > 0 ? (
              <div className="mt-auto shrink-0 overflow-hidden" style={{ height: "52mm" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={secondary[secondary.length - 1]}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null
          )}
        </div>
      </div>
    </section>
  );
}

export function LandmarkLightTemplate({ report }: ReportTemplateProps) {
  return <LandmarkReportPageOne report={report} />;
}

export function LandmarkDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <LandmarkReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
