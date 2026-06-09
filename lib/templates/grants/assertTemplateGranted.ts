import { getTemplateCatalogEntry } from "@/lib/templates/catalog";
import { isTemplateGranted } from "@/lib/templates/grants/repository";

export class TemplateNotGrantedError extends Error {
  code = "template_not_granted" as const;

  constructor(templateId: string) {
    super(`Template "${templateId}" is not available for this account`);
    this.name = "TemplateNotGrantedError";
  }
}

export async function assertTemplateGranted(
  agencyId: string,
  templateId: string,
): Promise<void> {
  const entry = getTemplateCatalogEntry(templateId);
  if (!entry) {
    throw new TemplateNotGrantedError(templateId);
  }

  if (entry.scope === "platform") {
    return;
  }

  const granted = await isTemplateGranted(agencyId, templateId);
  if (!granted) {
    throw new TemplateNotGrantedError(templateId);
  }
}
