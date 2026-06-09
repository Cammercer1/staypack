import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import { createBrochureStyleReportPageOne } from "@/lib/reports/templates/shared/createBrochureStyleReportPageOne";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

export const SplitReportPageOne = createBrochureStyleReportPageOne("split");

export function SplitLightTemplate({ report }: ReportTemplateProps) {
  return <SplitReportPageOne report={report} />;
}

export function SplitDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <SplitReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
