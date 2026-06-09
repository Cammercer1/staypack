import { COLLATERAL_TEMPLATES } from "@/lib/collateral/templates/registry";
import { REPORT_TEMPLATES } from "@/lib/reports/templates/registry";
import {
  enrichBrochureTemplate,
  enrichReportTemplate,
} from "@/lib/templates/enrichMetadata";
import type {
  TemplateCatalogEntry,
  TemplateProduct,
} from "@/lib/templates/types";

let cachedCatalog: TemplateCatalogEntry[] | null = null;

export function getTemplateCatalog(): TemplateCatalogEntry[] {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const reportEntries = REPORT_TEMPLATES.map(enrichReportTemplate);
  const brochureEntries = COLLATERAL_TEMPLATES.map(enrichBrochureTemplate).filter(
    (entry): entry is NonNullable<typeof entry> => entry != null,
  );

  cachedCatalog = [...reportEntries, ...brochureEntries];
  return cachedCatalog;
}

export function getTemplateCatalogEntry(
  templateId: string,
): TemplateCatalogEntry | null {
  return getTemplateCatalog().find((entry) => entry.id === templateId) ?? null;
}

export function getTemplatesForProduct(
  product: TemplateProduct,
): TemplateCatalogEntry[] {
  return getTemplateCatalog().filter((entry) => entry.product === product);
}
