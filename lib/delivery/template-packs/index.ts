import {
  DEFAULT_REPORT_TEMPLATE_ID,
  isValidReportTemplateId,
} from "@/lib/reports/templates/ids";

export type StrTemplatePack = {
  id: string;
  label: string;
  templateId?: string;
  /** Future: theme tokens, section toggles, copy overrides */
  theme?: Record<string, string>;
};

/** Built-in packs; tenants reference by id via `str_template_pack_id`. */
export const STR_TEMPLATE_PACKS: Record<string, StrTemplatePack> = {
  default: {
    id: "default",
    label: "StayPacks default STR",
  },
  minimalist: {
    id: "minimalist",
    label: "Minimalist STR (detailed)",
    templateId: "minimalist-detailed",
  },
  classic_detailed: {
    id: "classic_detailed",
    label: "Classic STR (detailed)",
    templateId: "classic-detailed",
  },
  haven_properties: {
    id: "haven_properties",
    label: "Haven Properties STR",
    templateId: "haven-properties-str",
  },
};

export function resolveStrTemplatePack(packId: string | null | undefined): StrTemplatePack {
  if (!packId) return STR_TEMPLATE_PACKS.default;
  return STR_TEMPLATE_PACKS[packId] ?? STR_TEMPLATE_PACKS.default;
}

export function templateIdFromPack(packId: string | null | undefined): string {
  const pack = resolveStrTemplatePack(packId);
  if (pack.templateId && isValidReportTemplateId(pack.templateId)) {
    return pack.templateId;
  }
  return DEFAULT_REPORT_TEMPLATE_ID;
}
