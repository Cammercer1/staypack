import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import { createBrochureStyleReportPageOne } from "@/lib/reports/templates/shared/createBrochureStyleReportPageOne";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

export const EditorialReportPageOne = createBrochureStyleReportPageOne("editorial");

export function EditorialLightTemplate({ report }: ReportTemplateProps) {
  return <EditorialReportPageOne report={report} />;
}

export function EditorialDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <EditorialReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
