import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import { ClassicPageOne } from "@/lib/reports/templates/classic/PageOne";

export function ClassicTemplate({ report }: ReportTemplateProps) {
  return <ClassicPageOne report={report} />;
}
