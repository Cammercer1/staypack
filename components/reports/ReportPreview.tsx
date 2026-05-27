import type { FinalReportJson } from "@/lib/types";
import {
  resolveBodyFontFamily,
  resolveHeadingFontFamily,
} from "@/lib/branding/google-fonts";
import { BrandFontLoader } from "@/components/settings/BrandFontLoader";
import { getReportTemplate } from "@/lib/reports/templates/registry";
import { resolveTemplateIdFromFinalReport } from "@/lib/reports/templates/resolveTemplateId";

export function ReportPreview({
  report,
  printMode = false,
}: {
  report: FinalReportJson;
  printMode?: boolean;
}) {
  const template = getReportTemplate(resolveTemplateIdFromFinalReport(report));
  const Template = template.Component;

  const fonts = {
    heading_font_family: report.agency.heading_font_family || report.agency.font_family,
    body_font_family: report.agency.body_font_family || report.agency.font_family,
    heading_font_file_url: report.agency.heading_font_file_url,
    body_font_file_url: report.agency.body_font_file_url || report.agency.font_file_url,
  };

  const headingFamily = resolveHeadingFontFamily(
    fonts.heading_font_family,
    fonts.heading_font_file_url,
  );
  const bodyFamily = resolveBodyFontFamily(
    fonts.body_font_family,
    fonts.body_font_file_url,
  );
  const textColour = report.agency.text_colour || report.agency.primary_colour;
  const backgroundColour =
    report.agency.background_colour || report.agency.secondary_colour;

  return (
    <div
      className={printMode ? "report-preview print-mode" : "report-preview"}
      style={{
        color: textColour,
        backgroundColor: backgroundColour,
        fontFamily: bodyFamily,
        ["--report-heading-font" as string]: headingFamily,
        ["--report-body-font" as string]: bodyFamily,
      }}
    >
      <BrandFontLoader fonts={fonts} />
      <Template report={report} />
    </div>
  );
}
