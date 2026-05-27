import {
  getClassicCopyLimits,
  type ClassicCopyField,
} from "@/lib/reports/templates/classic/copyLimits";
import {
  isClassicTemplateId,
  normalizeReportTemplateId,
} from "@/lib/reports/templates/ids";

export type TemplateCopyFieldLimit = {
  max: number;
  label: string;
  hint: string;
};

export function getTemplateCopyFieldLimit(
  templateId: string,
  field: ClassicCopyField,
): TemplateCopyFieldLimit | null {
  const normalized = normalizeReportTemplateId(templateId);

  if (!isClassicTemplateId(normalized)) {
    return null;
  }

  return getClassicCopyLimits(normalized)[field];
}
