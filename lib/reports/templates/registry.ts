import { ClassicDetailedTemplate } from "@/lib/reports/templates/classic/DetailedTemplate";
import { ClassicLightTemplate } from "@/lib/reports/templates/classic/LightTemplate";
import {
  CLASSIC_DETAILED_TEMPLATE_ID,
  CLASSIC_LIGHT_TEMPLATE_ID,
  DEFAULT_REPORT_TEMPLATE_ID,
  isValidReportTemplateId,
  normalizeReportTemplateId,
  REPORT_TEMPLATE_IDS,
} from "@/lib/reports/templates/ids";
import type { ReportTemplateDefinition } from "@/lib/reports/templates/types";

export {
  DEFAULT_REPORT_TEMPLATE_ID,
  isValidReportTemplateId,
  normalizeReportTemplateId,
  REPORT_TEMPLATE_IDS,
};

export const REPORT_TEMPLATES: ReportTemplateDefinition[] = [
  {
    id: CLASSIC_LIGHT_TEMPLATE_ID,
    family: "classic",
    tier: "light",
    label: "Classic — Light",
    description: "Single-page sales pack with headline STR estimate.",
    pages: 1,
    sourcePath: "lib/reports/templates/classic",
    Component: ClassicLightTemplate,
  },
  {
    id: CLASSIC_DETAILED_TEMPLATE_ID,
    family: "classic",
    tier: "detailed",
    label: "Classic — Detailed",
    description:
      "Two-page report with revenue range, comparable listings, and seasonality.",
    pages: 2,
    sourcePath: "lib/reports/templates/classic",
    Component: ClassicDetailedTemplate,
  },
];

export function getReportTemplate(id: string): ReportTemplateDefinition {
  const normalizedId = normalizeReportTemplateId(id);
  const template = REPORT_TEMPLATES.find((entry) => entry.id === normalizedId);

  if (template) {
    return template;
  }

  return REPORT_TEMPLATES.find((entry) => entry.id === DEFAULT_REPORT_TEMPLATE_ID)!;
}
