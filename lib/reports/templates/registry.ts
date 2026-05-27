import { ClassicTemplate } from "@/lib/reports/templates/classic";
import {
  DEFAULT_REPORT_TEMPLATE_ID,
  isValidReportTemplateId,
  REPORT_TEMPLATE_IDS,
} from "@/lib/reports/templates/ids";
import type { ReportTemplateDefinition } from "@/lib/reports/templates/types";

export { DEFAULT_REPORT_TEMPLATE_ID, isValidReportTemplateId, REPORT_TEMPLATE_IDS };

export const REPORT_TEMPLATES: ReportTemplateDefinition[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Logo top-left, hero image and metrics side by side.",
    pages: 2,
    Component: ClassicTemplate,
  },
];

export function getReportTemplate(id: string): ReportTemplateDefinition {
  const template = REPORT_TEMPLATES.find((entry) => entry.id === id);

  if (template) {
    return template;
  }

  return REPORT_TEMPLATES.find((entry) => entry.id === DEFAULT_REPORT_TEMPLATE_ID)!;
}
