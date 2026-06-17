import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import { ClassicLightTemplate } from "@/lib/reports/templates/classic/LightTemplate";
import { ClassicDetailedTemplate } from "@/lib/reports/templates/classic/DetailedTemplate";

export { ClassicLightTemplate, ClassicDetailedTemplate };

/** @deprecated Use ClassicDetailedTemplate */
export const ClassicTemplate = ClassicDetailedTemplate;

export function ClassicTemplateRouter({ report }: ReportTemplateProps) {
  return <ClassicDetailedTemplate report={report} />;
}
