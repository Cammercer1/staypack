import { getTemplateCatalogEntry } from "@/lib/templates/catalog";
import type { TemplateCatalogMetadata } from "@/lib/templates/types";

export type TemplateMetadata = TemplateCatalogMetadata;

export function getTemplateMetadata(
  templateId: string,
): TemplateMetadata | null {
  const entry = getTemplateCatalogEntry(templateId);
  if (!entry) {
    return null;
  }

  return {
    product: entry.product,
    scope: entry.scope,
    brandMode: entry.brandMode,
    defaultBlurbLength: entry.defaultBlurbLength,
    blurbLengthLocked: entry.blurbLengthLocked,
    fixedBrandKitId: entry.fixedBrandKitId,
  };
}
