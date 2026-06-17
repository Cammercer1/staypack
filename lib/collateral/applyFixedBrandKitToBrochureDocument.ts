import { applyBelleBrandKitToAgencySlice } from "@/lib/branding/kits/belle";
import { getTemplateMetadata } from "@/lib/templates/getTemplateMetadata";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";

export function applyFixedBrandKitToBrochureDocument(
  document: BrochureDocumentJson,
  templateId: string,
): BrochureDocumentJson {
  const meta = getTemplateMetadata(templateId);
  if (meta?.brandMode === "fixed" && meta.fixedBrandKitId === "belle") {
    return {
      ...document,
      agency: applyBelleBrandKitToAgencySlice(document.agency),
    };
  }
  return document;
}
