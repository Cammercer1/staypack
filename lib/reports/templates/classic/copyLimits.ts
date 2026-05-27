import type { AiCopyJson } from "@/lib/types";
import {
  CLASSIC_DETAILED_TEMPLATE_ID,
  CLASSIC_LIGHT_TEMPLATE_ID,
  normalizeReportTemplateId,
} from "@/lib/reports/templates/ids";

export const CLASSIC_LIGHT_COPY_LIMITS = {
  sales_pack_heading: {
    max: 90,
    label: "Heading",
    hint: "Short subtitle shown under the address.",
  },
  sales_pack_blurb: {
    max: 340,
    label: "Blurb",
    hint: "About 4–5 lines on the Classic light layout. Text must fit in full.",
  },
  key_metrics_line: {
    max: 180,
    label: "Key metrics line",
    hint: "Supporting line under the revenue figure.",
  },
} as const;

export const CLASSIC_DETAILED_COPY_LIMITS = {
  sales_pack_heading: {
    max: 90,
    label: "Heading",
    hint: "Short subtitle shown under the address.",
  },
  sales_pack_blurb: {
    max: 220,
    label: "Blurb",
    hint: "Shorter on page 1 — detailed evidence continues on page 2.",
  },
  key_metrics_line: {
    max: 140,
    label: "Key metrics line",
    hint: "Brief supporting line; avoid repeating page-2 data.",
  },
} as const;

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
  templateId: string = CLASSIC_LIGHT_TEMPLATE_ID,
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
- sales_pack_blurb: ${limits.sales_pack_blurb.max} characters
- key_metrics_line: ${limits.key_metrics_line.max} characters`;
}
