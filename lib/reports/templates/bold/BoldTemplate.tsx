import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import { createBrochureStyleReportPageOne } from "@/lib/reports/templates/shared/createBrochureStyleReportPageOne";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

export const BoldReportPageOne = createBrochureStyleReportPageOne("bold");

export function BoldLightTemplate({ report }: ReportTemplateProps) {
  return <BoldReportPageOne report={report} />;
}

export function BoldDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <BoldReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
