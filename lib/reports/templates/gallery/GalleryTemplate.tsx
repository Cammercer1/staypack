import { Bath, BedDouble, Car, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { formatNumber } from "@/lib/reports/formatters";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import {
  resolveReportAgents,
  StrRevenueBlock,
} from "@/lib/reports/templates/shared/StrRevenueBlock";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import type { FinalReportJson } from "@/lib/types";

const headingFont = "var(--report-heading-font, inherit)";
const bodyFont = "var(--report-body-font, inherit)";

function resolveGalleryReportPhotos(report: FinalReportJson) {
  const hero = report.property.hero_image_url || "";
  const rest = report.property.selected_image_urls.filter(Boolean);
  return {
    hero,
    thumbs: [rest[0] ?? hero, rest[1] ?? rest[0] ?? hero, rest[2] ?? rest[1] ?? hero].filter(
      Boolean,
    ),
  };
}

function GalleryReportSpecItem({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-neutral-800">
      <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" strokeWidth={1.75} aria-hidden />
      <span
        className="text-[0.9rem] font-semibold tabular-nums"
        style={{ fontFamily: bodyFont }}
      >
        {value}
      </span>
    </div>
  );
}

export function GalleryReportPageOne({ report }: { report: FinalReportJson }) {
  const brand = getReportBrandColours(report.agency);
  const { hero, thumbs } = resolveGalleryReportPhotos(report);
  const logoUrl = getAgencyLogoUrl(report.agency, "light");
  const logoBg = report.agency.accent_colour || report.agency.primary_colour;
  const { property } = report;
  const agents = resolveReportAgents(report);
  const agent = agents[0];

  const specs: { id: string; icon: LucideIcon; value: string }[] = [];
  if (property.bedrooms) specs.push({ id: "bed", icon: BedDouble, value: formatNumber(property.bedrooms) });
  if (property.bathrooms) specs.push({ id: "bath", icon: Bath, value: formatNumber(property.bathrooms) });
  if (property.car_spaces) specs.push({ id: "car", icon: Car, value: formatNumber(property.car_spaces) });
  if (property.accommodates) specs.push({ id: "guests", icon: Users, value: formatNumber(property.accommodates) });

  const suburb = property.suburb?.trim() ?? "";
  const state = property.state?.trim().toUpperCase() ?? "";
  const postcode = property.postcode?.trim() ?? "";
  const statePostcode = [state, postcode].filter(Boolean).join(" ");
  const rawAddress = property.address?.trim() ?? "";
  const street = suburb
    ? rawAddress.replace(new RegExp(`,?\\s*${suburb}.*$`, "i"), "").trim().toLowerCase()
    : rawAddress.toLowerCase();

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        height: "var(--report-page-height, 297mm)",
      }}
    >
      {/* Photo mosaic — ~70% of page */}
      <div className="relative flex shrink-0 flex-col gap-[6px]" style={{ height: "70%" }}>
        <div className="relative min-h-0 flex-[1.5] overflow-hidden bg-neutral-200">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt="" className="h-full w-full object-cover" />
          ) : null}
          {logoUrl ? (
            <div
              className="absolute right-[5%] top-0 z-10 px-5 py-3"
              style={{ backgroundColor: logoBg }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={report.agency.name}
                className="h-8 max-w-[130px] object-contain"
              />
            </div>
          ) : null}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[6px]">
          {thumbs.map((url, i) => (
            <div key={`${url}-${i}`} className="min-h-0 overflow-hidden bg-neutral-200">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Info bar */}
      <div className="shrink-0 px-8 pt-4">
        <div className="flex items-center justify-between gap-6 pb-3">
          <p className="min-w-0 text-[0.95rem] text-neutral-900" style={{ fontFamily: bodyFont }}>
            {street ? <span className="font-normal">{street}</span> : null}
            {suburb ? (
              <>
                {street ? ", " : null}
                <span className="font-semibold">{suburb.toLowerCase()}</span>
              </>
            ) : null}
            {statePostcode ? (
              <>
                {street || suburb ? ", " : null}
                <span className="font-semibold">{statePostcode}</span>
              </>
            ) : null}
          </p>
          {specs.length > 0 ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-5">
              {specs.map((s) => (
                <GalleryReportSpecItem key={s.id} icon={s.icon} value={s.value} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="border-b border-neutral-300" />
      </div>

      {/* Details row */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_0.75fr_0.85fr] gap-6 overflow-hidden px-8 py-5">
        <div className="min-w-0">
          {report.copy.blurb ? (
            <p
              className="line-clamp-6 text-[0.76rem] leading-[1.65] text-neutral-700"
              style={{ fontFamily: bodyFont }}
            >
              {report.copy.blurb}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <StrRevenueBlock report={report} compact />
        </div>

        {agent ? (
          <div className="text-right text-[0.74rem] leading-snug text-neutral-700">
            {agent.name ? (
              <p
                className="text-[0.82rem] font-bold uppercase tracking-wide text-neutral-900"
                style={{ fontFamily: headingFont }}
              >
                {agent.name}
              </p>
            ) : null}
            {agent.phone ? <p className="mt-2">{agent.phone}</p> : null}
            {agent.email ? <p className="mt-1 break-all text-neutral-600">{agent.email}</p> : null}
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex shrink-0 items-center justify-between gap-6 px-8 py-4">
        {report.agency.website_url ? (
          <p
            className="text-[0.95rem] font-medium text-neutral-700"
            style={{ fontFamily: bodyFont }}
          >
            {report.agency.website_url.replace(/^https?:\/\//, "")}
          </p>
        ) : (
          <div />
        )}
        {report.assets.qr_code_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={report.assets.qr_code_url} alt="QR" className="h-14 w-14 shrink-0" />
        ) : null}
      </div>
    </section>
  );
}

export function GalleryLightTemplate({ report }: ReportTemplateProps) {
  return <GalleryReportPageOne report={report} />;
}

export function GalleryDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <GalleryReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
