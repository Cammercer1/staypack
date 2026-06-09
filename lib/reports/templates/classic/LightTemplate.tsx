import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import { ClassicPageOne } from "@/lib/reports/templates/classic/PageOne";

export function ClassicLightTemplate({ report }: ReportTemplateProps) {
  return <ClassicPageOne report={report} tier="light" />;
}
