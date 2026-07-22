import Image from "next/image";
import { BrandFontLoader } from "@/components/settings/BrandFontLoader";
import { ReportEditableImage } from "@/components/reports/inline/ReportEditableImage";
import {
  ReportCopyAppealPoint,
  ReportCopyBlurb,
} from "@/components/reports/inline/ReportCopyFields";
import { getReportFontConfig } from "@/lib/reports/reportFonts";
import { resolveHeroGalleryImages } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { rentCalloutFromReport } from "@/lib/lease-appraisal/formatRentCallout";
import { OcRealEstateSalesAppraisalPageTwo } from "@/lib/reports/templates/oc-real-estate/OcRealEstateSalesAppraisalPageTwo";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import type { FinalReportJson } from "@/lib/types";
import type { ReportImageSlot } from "@/lib/reports/editable/reportImageSlots";

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function formatSalesEstimate(report: FinalReportJson) {
  const estimate = report.sale_estimate;
  if (estimate?.price_min == null || estimate.price_max == null) {
    return "Price on request";
  }

  return `${currency.format(estimate.price_min)} – ${currency.format(estimate.price_max)}`;
}

function formatLeaseEstimate(report: FinalReportJson) {
  const amount = rentCalloutFromReport(report.ltr);
  return amount ? `${amount} / week` : "Rent on request";
}

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

export function OcRealEstateSalesAppraisalPageOne({
  report,
  variant = "sales",
}: {
  report: FinalReportJson;
  variant?: "sales" | "lease";
}) {
  const { hero, secondary } = resolveHeroGalleryImages(report.property);
  const gallery = secondary.slice(0, 2);
  const fonts = getReportFontConfig(report.agency);
  const logo = report.agency.logo_dark_url || report.agency.logo_url;
  const estimate =
    variant === "lease" ? formatLeaseEstimate(report) : formatSalesEstimate(report);
  const title = variant === "lease" ? "Rental appraisal." : "Property appraisal.";
  const estimateLabel = variant === "lease" ? "Rent guide" : "Estimate";
  const address = report.property.address;

  return (
    <article
      data-testid={
        variant === "lease" ? "oc-lease-appraisal-page-one" : "oc-concept-page"
      }
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

      <div
        data-testid="oc-concept-gallery-strip"
        className="grid h-[222px] grid-cols-2 overflow-hidden bg-white"
      >
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
            className="text-[36px] font-semibold leading-none tracking-[-0.025em]"
            style={{ fontFamily: fonts.headingFontFamily }}
          >
            {title}
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
          <div data-testid="oc-concept-copy" className="overflow-hidden pr-3">
            <div data-testid="oc-concept-opening-paragraph">
              <ReportCopyBlurb
                blurb={report.copy.blurb}
                paraClassName="text-[13px] leading-[1.2]"
              />
            </div>
            <ul className="mt-[15px] space-y-[8px] text-[12px] leading-[1.2]">
              {report.copy.appeal_points.map((point, index) => (
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
            <div
              data-testid="oc-concept-estimate"
              className="grid grid-cols-[70px_minmax(0,1fr)] items-baseline gap-4"
            >
              <span
                className="text-[16px] font-medium leading-none"
                style={{ fontFamily: fonts.headingFontFamily }}
              >
                {estimateLabel}
              </span>
              <strong className="whitespace-nowrap text-right text-[18px] font-extrabold leading-none tracking-[-0.025em] tabular-nums">
                {estimate}
              </strong>
            </div>
            <dl
              className="mt-auto space-y-1.5 text-[17px] leading-none"
              style={{ fontFamily: fonts.headingFontFamily }}
            >
              <div className="flex items-baseline justify-between gap-5">
                <dt>Bed</dt>
                <dd className="font-extrabold">{report.property.bedrooms}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-5">
                <dt>Bath</dt>
                <dd className="font-extrabold">{report.property.bathrooms}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-5">
                <dt>Car</dt>
                <dd className="font-extrabold">{report.property.car_spaces}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </article>
  );
}

export function OcRealEstateSalesAppraisalTemplate({
  report,
}: ReportTemplateProps) {
  return (
    <>
      <OcRealEstateSalesAppraisalPageOne report={report} />
      <OcRealEstateSalesAppraisalPageTwo report={report} />
    </>
  );
}
