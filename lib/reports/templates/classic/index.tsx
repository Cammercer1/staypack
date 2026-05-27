import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import { ClassicLightTemplate } from "@/lib/reports/templates/classic/LightTemplate";
import { ClassicDetailedTemplate } from "@/lib/reports/templates/classic/DetailedTemplate";

export { ClassicLightTemplate, ClassicDetailedTemplate };

/** @deprecated Use ClassicLightTemplate */
export const ClassicTemplate = ClassicLightTemplate;

export function ClassicTemplateRouter({ report }: ReportTemplateProps) {
  const templateId = report.template_id;

  if (templateId === "classic-detailed") {
    return <ClassicDetailedTemplate report={report} />;
  }

  return <ClassicLightTemplate report={report} />;
}
