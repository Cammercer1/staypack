import { getTemplateCatalogEntry } from "@/lib/templates/catalog";
import { resolveAvailableTemplates } from "@/lib/templates/resolveAvailableTemplates";
import type { Agency } from "@/lib/types";

export class TemplateNotGrantedError extends Error {
  code = "template_not_granted" as const;

  constructor(templateId: string) {
    super(`Template "${templateId}" is not available for this account`);
    this.name = "TemplateNotGrantedError";
  }
}

export async function assertTemplateGranted(
  agency: Agency,
  templateId: string,
): Promise<void> {
  const entry = getTemplateCatalogEntry(templateId);
  if (!entry) {
    throw new TemplateNotGrantedError(templateId);
  }

  const available = await resolveAvailableTemplates(agency, entry.product);
  if (!available.templates.some((template) => template.id === templateId)) {
    throw new TemplateNotGrantedError(templateId);
  }
}
