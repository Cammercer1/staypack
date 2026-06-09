import {
  PAGE_ONE_BLURB_MAX,
  PAGE_ONE_BULLET_COUNT,
  PAGE_ONE_BULLET_MAX,
  PAGE_ONE_HEADING_MAX,
} from "@/lib/copy/pageOneMarketingCopy";
import type { AiCopyJson } from "@/lib/types";
import {
  CLASSIC_DETAILED_TEMPLATE_ID,
  normalizeReportTemplateId,
} from "@/lib/reports/templates/ids";

export const CLASSIC_LIGHT_COPY_LIMITS = {
  sales_pack_heading: {
    max: PAGE_ONE_HEADING_MAX,
    label: "Heading",
    hint: "Engaging title shown under the address.",
  },
  sales_pack_blurb: {
    max: PAGE_ONE_BLURB_MAX,
    label: "Blurb",
    hint: "One short paragraph (max 350 characters).",
  },
  key_metrics_line: {
    max: 180,
    label: "Key metrics line",
    hint: "Supporting line under the revenue figure (auto-filled from estimate).",
  },
} as const;

export const CLASSIC_DETAILED_COPY_LIMITS = CLASSIC_LIGHT_COPY_LIMITS;

export type ClassicCopyField = keyof typeof CLASSIC_LIGHT_COPY_LIMITS;

export function getClassicCopyLimits(templateId: string) {
  const normalized = normalizeReportTemplateId(templateId);

  if (normalized === CLASSIC_DETAILED_TEMPLATE_ID) {
    return CLASSIC_DETAILED_COPY_LIMITS;
  }

  return CLASSIC_LIGHT_COPY_LIMITS;
}

export function trimToWordBoundary(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }

  const slice = trimmed.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");

  if (lastSpace > max * 0.6) {
    return slice.slice(0, lastSpace).trim();
  }

  return slice.trim();
}

export function enforceClassicCopyField(
  field: ClassicCopyField,
  value: string,
  templateId: string,
) {
  const limits = getClassicCopyLimits(templateId);
  return trimToWordBoundary(value, limits[field].max);
}

export function enforceClassicCopyLimits(
  copy: AiCopyJson,
  templateId: string = CLASSIC_DETAILED_TEMPLATE_ID,
): AiCopyJson {
  return {
    ...copy,
    sales_pack_heading: enforceClassicCopyField(
      "sales_pack_heading",
      copy.sales_pack_heading,
      templateId,
    ),
    sales_pack_blurb: enforceClassicCopyField(
      "sales_pack_blurb",
      copy.sales_pack_blurb,
      templateId,
    ),
    key_metrics_line: enforceClassicCopyField(
      "key_metrics_line",
      copy.key_metrics_line,
      templateId,
    ),
    property_appeal_points: copy.property_appeal_points
      .slice(0, PAGE_ONE_BULLET_COUNT)
      .map((item) => trimToWordBoundary(item, PAGE_ONE_BULLET_MAX)),
  };
}

export function getClassicCopyPromptLimits(templateId: string) {
  const limits = getClassicCopyLimits(templateId);
  const tier =
    normalizeReportTemplateId(templateId) === CLASSIC_DETAILED_TEMPLATE_ID
      ? "detailed (2 pages)"
      : "light (1 page)";

  return `Classic ${tier} layout hard maximums:
- sales_pack_heading: ${limits.sales_pack_heading.max} characters
- sales_pack_blurb: ${limits.sales_pack_blurb.max} characters (single paragraph)
- property_appeal_points: exactly ${PAGE_ONE_BULLET_COUNT} bullets, ${PAGE_ONE_BULLET_MAX} characters each
- key_metrics_line: ${limits.key_metrics_line.max} characters`;
}
