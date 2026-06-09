import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import { createBrochureStyleReportPageOne } from "@/lib/reports/templates/shared/createBrochureStyleReportPageOne";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

export const LandmarkReportPageOne = createBrochureStyleReportPageOne("landmark");

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
