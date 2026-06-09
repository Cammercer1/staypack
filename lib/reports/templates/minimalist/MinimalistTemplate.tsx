import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import { createBrochureStyleReportPageOne } from "@/lib/reports/templates/shared/createBrochureStyleReportPageOne";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

export const MinimalistReportPageOne = createBrochureStyleReportPageOne("minimalist");

export function MinimalistLightTemplate({ report }: ReportTemplateProps) {
  return <MinimalistReportPageOne report={report} />;
}

export function MinimalistDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <MinimalistReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
