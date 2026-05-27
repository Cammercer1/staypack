import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import { ClassicPageOne } from "@/lib/reports/templates/classic/PageOne";
import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";

export function ClassicDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <ClassicPageOne report={report} variant="detailed" />
      <ClassicPageTwo report={report} />
    </>
  );
}
