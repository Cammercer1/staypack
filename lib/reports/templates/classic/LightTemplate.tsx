import type { ReportTemplateProps } from "@/lib/reports/templates/types";
import { ClassicDetailedTemplate } from "@/lib/reports/templates/classic/DetailedTemplate";

/** @deprecated Kept for legacy imports; renders the detailed STR template. */
export function ClassicLightTemplate({ report }: ReportTemplateProps) {
  return <ClassicDetailedTemplate report={report} />;
}
