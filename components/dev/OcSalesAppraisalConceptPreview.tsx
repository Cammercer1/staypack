"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { OcSalesAppraisalConceptPageTwo } from "@/components/dev/OcSalesAppraisalConceptPageTwo";
import { BrandFontLoader } from "@/components/settings/BrandFontLoader";
import {
  getReportBrandAdvancedVars,
  getReportBrandColourVars,
  getReportBrandColours,
  getReportBrandLogoVars,
} from "@/lib/reports/brandColours";
import { mmToPx } from "@/lib/reports/pageFormat";
import { getReportFontConfig } from "@/lib/reports/reportFonts";
import { resolveHeroGalleryImages } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import type { FinalReportJson } from "@/lib/types";

const PAGE_WIDTH_PX = mmToPx(210);
const PAGE_HEIGHT_PX = mmToPx(297);

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function formatEstimate(report: FinalReportJson) {
  const estimate = report.sale_estimate;
  if (estimate?.price_min == null || estimate.price_max == null) {
    return "Price on request";
  }

  return `${currency.format(estimate.price_min)} – ${currency.format(estimate.price_max)}`;
}

function PropertyImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return <div className="h-full w-full bg-neutral-300" />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      className="object-cover"
      sizes="794px"
      priority
    />
  );
}

function OcConceptPage({ report }: { report: FinalReportJson }) {
  const { hero, secondary } = resolveHeroGalleryImages(report.property);
  const gallery = secondary.slice(0, 2);
  const fonts = getReportFontConfig(report.agency);
  const logo = report.agency.logo_dark_url || report.agency.logo_url;
  const estimate = formatEstimate(report);
  const address = report.property.address;

  return (
    <article
      data-testid="oc-concept-page"
      className="relative overflow-hidden bg-white text-[#15110f]"
      style={{
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
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
        <PropertyImage src={hero} alt={address} />
      </div>

      <div
        data-testid="oc-concept-gallery-strip"
        className="grid h-[222px] grid-cols-2 overflow-hidden bg-white"
      >
        <div className="relative overflow-hidden">
          <PropertyImage src={gallery[0] ?? hero} alt={`${address} gallery image 1`} />
        </div>
        <div className="relative overflow-hidden">
          <PropertyImage src={gallery[1] ?? gallery[0] ?? hero} alt={`${address} gallery image 2`} />
        </div>
      </div>

      <div className="h-[471px] bg-[#F2E3CF] px-[42px] pb-[30px] pt-[28px]">
        <div className="flex min-h-[55px] items-start justify-between gap-8">
          <h2
            className="text-[36px] font-semibold leading-none tracking-[-0.025em]"
            style={{ fontFamily: fonts.headingFontFamily }}
          >
            Property appraisal.
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

        <div className="mt-1">
          <p
            className="max-w-[500px] pr-2 text-[21px] leading-[1.16] tracking-[-0.01em]"
            style={{ fontFamily: fonts.headingFontFamily }}
          >
            {address}
          </p>
        </div>

        <div className="mt-[27px] grid h-[292px] grid-cols-[minmax(0,1fr)_300px] gap-8">
          <div
            data-testid="oc-concept-copy"
            className="overflow-hidden pr-3"
          >
            <p
              data-testid="oc-concept-opening-paragraph"
              className="text-[13px] leading-[1.2]"
            >
              {report.copy.blurb}
            </p>
            <ul className="mt-[15px] space-y-[8px] text-[12px] leading-[1.2]">
              {report.copy.appeal_points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[0.48em] h-[4px] w-[4px] shrink-0 rounded-full"
                    style={{ backgroundColor: report.agency.primary_colour }}
                  />
                  <span>{point}</span>
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
                Estimate
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

function OcConceptPageTwo({ report }: { report: FinalReportJson }) {
  const fonts = getReportFontConfig(report.agency);
  const brand = getReportBrandColours(report.agency);

  return (
    <div
      data-testid="oc-concept-page-two"
      className="report-preview print-mode"
      style={{
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
        ["--report-page-width" as string]: `${PAGE_WIDTH_PX}px`,
        ["--report-page-height" as string]: `${PAGE_HEIGHT_PX}px`,
        ["--report-heading-font" as string]: fonts.headingFontFamily,
        ["--report-body-font" as string]: fonts.bodyFontFamily,
        ...getReportBrandColourVars(brand),
        ...getReportBrandLogoVars(report.agency),
        ...getReportBrandAdvancedVars(report.agency),
        color: brand.text,
        backgroundColor: brand.pageBackground,
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
      <OcSalesAppraisalConceptPageTwo report={report} />
    </div>
  );
}

export function OcSalesAppraisalConceptPreview({
  report,
  maxHeight = "calc(100vh - 11.25rem)",
}: {
  report: FinalReportJson;
  maxHeight?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [currentPage, setCurrentPage] = useState<0 | 1>(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const padding = 24;
      const availableWidth = container.clientWidth - padding;
      const availableHeight = container.clientHeight - padding;
      const nextScale = Math.min(
        availableWidth / PAGE_WIDTH_PX,
        availableHeight / PAGE_HEIGHT_PX,
        1,
      );
      setScale(nextScale > 0 ? nextScale : 0.6);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-xl border border-neutral-300 bg-white/50 shadow-sm"
      style={{ height: maxHeight, maxHeight }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-300 bg-white/90 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setCurrentPage(0)}
          disabled={currentPage === 0}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm enabled:hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          ← Page 1
        </button>
        <div className="text-center">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-neutral-500">
            Working document
          </p>
          <p className="text-xs font-semibold text-neutral-800">Page {currentPage + 1} of 2</p>
        </div>
        <button
          type="button"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm enabled:hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Page 2 →
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-3"
      >
        <div
          className="shrink-0 overflow-hidden shadow-xl"
          style={{
            width: PAGE_WIDTH_PX * scale,
            height: PAGE_HEIGHT_PX * scale,
          }}
        >
          <div
            style={{
              width: PAGE_WIDTH_PX,
              height: PAGE_HEIGHT_PX,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {currentPage === 0 ? (
              <OcConceptPage report={report} />
            ) : (
              <OcConceptPageTwo report={report} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
