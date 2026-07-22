import Image from "next/image";
import { BrandFontLoader } from "@/components/settings/BrandFontLoader";
import { ReportEditableImage } from "@/components/reports/inline/ReportEditableImage";
import {
  ReportCopyAppealPoint,
  ReportCopyBlurb,
} from "@/components/reports/inline/ReportCopyFields";
import { formatCurrency, formatPercent } from "@/lib/reports/formatters";
import { getReportFontConfig } from "@/lib/reports/reportFonts";
import { resolveHeroGalleryImages } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { OcRealEstateStrPageTwo } from "@/lib/reports/templates/oc-real-estate/OcRealEstateStrPageTwo";
import type { ReportImageSlot } from "@/lib/reports/editable/reportImageSlots";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import type { FinalReportJson } from "@/lib/types";

function PropertyImage({
  src,
  alt,
  slot,
}: {
  src: string | null;
  alt: string;
  slot: ReportImageSlot;
}) {
  if (!src) {
    return <div className="h-full w-full bg-neutral-300" />;
  }

  return (
    <ReportEditableImage
      slot={slot}
      src={src}
      alt={alt}
      className="h-full w-full"
      imgClassName="h-full w-full object-cover"
    />
  );
}

export function OcRealEstateStrPageOne({
  report,
}: {
  report: FinalReportJson;
}) {
  const { hero, secondary } = resolveHeroGalleryImages(report.property);
  const gallery = secondary.slice(0, 2);
  const fonts = getReportFontConfig(report.agency);
  const logo = report.agency.logo_dark_url || report.agency.logo_url;
  const address = report.property.address;

  return (
    <article
      data-testid="oc-str-page-one"
      className="report-page relative overflow-hidden bg-white text-[#15110f]"
      style={{
        width: "var(--report-page-width, 210mm)",
        height: "var(--report-page-height, 297mm)",
        fontFamily: fonts.bodyFontFamily,
      }}
    >
      <BrandFontLoader
        fonts={{
          heading_font_family: fonts.headingFontId,
          body_font_family: fonts.bodyFontId,
          heading_font_file_url: report.agency.heading_font_file_url,
          body_font_file_url:
            report.agency.body_font_file_url || report.agency.font_file_url,
        }}
      />

      <div className="relative h-[430px] overflow-hidden">
        <PropertyImage src={hero} alt={address} slot="hero" />
      </div>

      <div className="grid h-[222px] grid-cols-2 overflow-hidden bg-white">
        <div className="relative overflow-hidden">
          <PropertyImage
            src={gallery[0] ?? hero}
            alt={`${address} gallery image 1`}
            slot={{ kind: "secondary", index: 0 }}
          />
        </div>
        <div className="relative overflow-hidden">
          <PropertyImage
            src={gallery[1] ?? gallery[0] ?? hero}
            alt={`${address} gallery image 2`}
            slot={{ kind: "secondary", index: 1 }}
          />
        </div>
      </div>

      <div className="h-[471px] bg-[#F2E3CF] px-[42px] pb-[30px] pt-[28px]">
        <div className="flex min-h-[55px] items-start justify-between gap-8">
          <h2
            className="max-w-[590px] text-[31px] font-semibold leading-none tracking-[-0.025em]"
            style={{ fontFamily: fonts.headingFontFamily }}
          >
            Short-term rental appraisal.
          </h2>
          {logo ? (
            <div className="relative mt-[-2px] h-[42px] w-[82px] shrink-0">
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
        </div>

        <p
          className="mt-1 max-w-[500px] pr-2 text-[21px] leading-[1.16] tracking-[-0.01em]"
          style={{ fontFamily: fonts.headingFontFamily }}
        >
          {address}
        </p>

        <div className="mt-[27px] grid h-[292px] grid-cols-[minmax(0,1fr)_300px] gap-8">
          <div data-testid="oc-str-page-one-copy" className="overflow-hidden pr-3">
            <ReportCopyBlurb
              blurb={report.copy.blurb}
              paraClassName="text-[13px] leading-[1.2]"
            />
            <ul className="mt-[15px] space-y-[8px] text-[12px] leading-[1.2]">
              {report.copy.appeal_points.slice(0, 4).map((point, index) => (
                <li key={`${index}-${point}`} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[0.48em] h-[4px] w-[4px] shrink-0 rounded-full"
                    style={{ backgroundColor: report.agency.primary_colour }}
                  />
                  <ReportCopyAppealPoint index={index} text={point} />
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col border-l-2 border-[#413532] pb-1 pl-7">
            <div>
              <p
                className="max-w-[220px] text-[11px] font-semibold uppercase leading-[1.2] tracking-[0.08em] text-[#6F5D57]"
                style={{ fontFamily: fonts.headingFontFamily }}
              >
                Estimated gross STR revenue
              </p>
              <strong className="mt-2 block whitespace-nowrap text-[29px] font-extrabold leading-none tracking-[-0.035em] tabular-nums">
                {formatCurrency(report.str.annual_revenue)}
              </strong>
              <p className="mt-2 text-[10px] leading-none text-[#6F5D57]">
                per year before costs
              </p>
            </div>

            <dl
              className="mt-auto space-y-2 text-[16px] leading-none"
              style={{ fontFamily: fonts.headingFontFamily }}
            >
              <div className="flex items-baseline justify-between gap-5">
                <dt>Nightly</dt>
                <dd className="font-extrabold">
                  {formatCurrency(report.str.nightly_rate)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-5">
                <dt>Occupancy</dt>
                <dd className="font-extrabold">
                  {formatPercent(report.str.occupancy_rate)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-5">
                <dt>Guests</dt>
                <dd className="font-extrabold">{report.property.accommodates}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </article>
  );
}

export function OcRealEstateStrTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <OcRealEstateStrPageOne report={report} />
      <OcRealEstateStrPageTwo report={report} />
    </>
  );
}
