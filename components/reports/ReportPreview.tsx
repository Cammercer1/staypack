"use client";

import type { FinalReportJson } from "@/lib/types";
import {
  getReportBrandAdvancedVars,
  getReportBrandColourVars,
  getReportBrandColours,
} from "@/lib/reports/brandColours";
import { BrandFontLoader } from "@/components/settings/BrandFontLoader";
import {
  getReportPageFormat,
  getReportPageFormatStyle,
  type ReportPageOrientation,
} from "@/lib/reports/pageFormat";
import { getReportFontConfig } from "@/lib/reports/reportFonts";
import { getReportTemplate } from "@/lib/reports/templates/registry";
import { resolveTemplateIdFromFinalReport } from "@/lib/reports/templates/resolveTemplateId";

export function ReportPreview({
  report,
  printMode = false,
  orientation = "portrait",
}: {
  report: FinalReportJson;
  printMode?: boolean;
  orientation?: ReportPageOrientation;
}) {
  const pageFormat = getReportPageFormat(orientation);
  const template = getReportTemplate(resolveTemplateIdFromFinalReport(report));
  const Template = template.Component;
  const brand = getReportBrandColours(report.agency);
  const fonts = getReportFontConfig(report.agency);

  return (
    <div
      className={printMode ? "report-preview print-mode" : "report-preview"}
      data-page-orientation={orientation}
      data-report-root
      style={{
        ...getReportPageFormatStyle(pageFormat),
        ...getReportBrandColourVars(brand),
        ...getReportBrandAdvancedVars(report.agency),
        color: brand.text,
        backgroundColor: brand.pageBackground,
        ["--report-heading-font" as string]: fonts.headingFontFamily,
        ["--report-body-font" as string]: fonts.bodyFontFamily,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .report-preview[data-report-root] {
              font-family: ${fonts.bodyFontFamily};
            }
            .report-preview[data-report-root] h1,
            .report-preview[data-report-root] h2,
            .report-preview[data-report-root] h3,
            .report-preview[data-report-root] h4 {
              font-family: ${fonts.headingFontFamily};
              letter-spacing: normal;
            }
          `,
        }}
      />
      <BrandFontLoader
        fonts={{
          heading_font_family: fonts.headingFontId,
          body_font_family: fonts.bodyFontId,
          heading_font_file_url: report.agency.heading_font_file_url,
          body_font_file_url:
            report.agency.body_font_file_url || report.agency.font_file_url,
        }}
      />
      <Template report={report} />
    </div>
  );
}
