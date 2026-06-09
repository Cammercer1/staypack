import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import { createBrochureStyleReportPageOne } from "@/lib/reports/templates/shared/createBrochureStyleReportPageOne";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

export const RefinedReportPageOne = createBrochureStyleReportPageOne("refined");

export function RefinedLightTemplate({ report }: ReportTemplateProps) {
  return <RefinedReportPageOne report={report} />;
}

export function RefinedDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <RefinedReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
