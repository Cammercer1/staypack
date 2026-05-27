import type { AiCopyJson } from "@/lib/types";
import { enforceClassicCopyLimits } from "@/lib/reports/templates/classic/copyLimits";
import {
  DEFAULT_REPORT_TEMPLATE_ID,
  isClassicTemplateId,
  normalizeReportTemplateId,
} from "@/lib/reports/templates/ids";

export function enforceTemplateCopyLimits(
  copy: AiCopyJson,
  templateId: string = DEFAULT_REPORT_TEMPLATE_ID,
): AiCopyJson {
  const normalized = normalizeReportTemplateId(templateId);

  if (isClassicTemplateId(normalized)) {
    return enforceClassicCopyLimits(copy, normalized);
  }

  return copy;
}
