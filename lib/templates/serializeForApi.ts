import type { TemplateCatalogEntry } from "@/lib/templates/types";

export type TemplateApiEntry = {
  id: string;
  label: string;
  description: string;
  product: string;
  scope: string;
  brand_mode: string;
  default_blurb_length: string;
  pages: number;
  tier?: string;
  family?: string;
};

export function serializeTemplateForApi(
  entry: TemplateCatalogEntry,
): TemplateApiEntry {
  const base = {
    id: entry.id,
    label: entry.label,
    description: entry.description,
    product: entry.product,
    scope: entry.scope,
    brand_mode: entry.brandMode,
    default_blurb_length: entry.defaultBlurbLength,
    pages: entry.pages,
    family: entry.family,
  };

  if (entry.kind === "report") {
    return { ...base, tier: entry.tier };
  }

  return base;
}
