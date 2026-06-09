import type { BlurbLength } from "@/lib/copy/blurbVariantConstants";
import type { BrochureCopyJson } from "@/lib/collateral/templates/types";
import {
  defaultBlurbLengthForFamily,
  isBoldFamily,
} from "@/lib/templates/familyDefaults";
import { getTemplateMetadata } from "@/lib/templates/getTemplateMetadata";
import { familyFromTemplateId } from "@/lib/reports/templates/playgroundResolve";
import { salesBrochureFamilyFromTemplateId } from "@/lib/reports/templates/salesBrochureFamilyMap";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";

function resolveLayoutFamilyForBlurb(
  templateId: string,
  collateral: ReportPageVariant,
): string {
  if (/(?:sales|rental)-brochure-.+-(?:1pg|2pg)$/.test(templateId)) {
    return salesBrochureFamilyFromTemplateId(templateId);
  }
  return familyFromTemplateId(templateId, collateral);
}

export function defaultBlurbLengthForTemplateId(
  templateId: string,
  collateral: ReportPageVariant = "sale",
): BlurbLength {
  const meta = getTemplateMetadata(templateId);
  if (meta) {
    return meta.defaultBlurbLength;
  }
  const family = resolveLayoutFamilyForBlurb(templateId, collateral);
  return defaultBlurbLengthForFamily(family);
}

/** Bold always uses the long blurb (STR / lease / sale). */
export function isBoldLayoutTemplate(
  templateId: string,
  collateral: ReportPageVariant = "sale",
): boolean {
  const meta = getTemplateMetadata(templateId);
  if (meta?.blurbLengthLocked) {
    return true;
  }
  return isBoldFamily(resolveLayoutFamilyForBlurb(templateId, collateral));
}

/**
 * Production: template registry metadata → family fallback.
 * Dev playground: optional copy.template_blurb_length overrides when allowDevMap is used via resolveCopyForTemplate.
 */
export function resolveBlurbLengthForTemplate(
  templateId: string,
  collateral: ReportPageVariant = "sale",
  copy?: Pick<BrochureCopyJson, "template_blurb_length">,
): BlurbLength {
  const meta = getTemplateMetadata(templateId);
  if (meta?.blurbLengthLocked) {
    return meta.defaultBlurbLength;
  }
  if (meta?.defaultBlurbLength) {
    return meta.defaultBlurbLength;
  }
  if (copy?.template_blurb_length?.[templateId]) {
    return copy.template_blurb_length[templateId]!;
  }
  return defaultBlurbLengthForTemplateId(templateId, collateral);
}

/** @deprecated Use resolveBlurbLengthForTemplate — dev mapping only when copy is passed */
export function resolveTemplateBlurbLength(
  copy: Pick<BrochureCopyJson, "template_blurb_length">,
  templateId: string,
  collateral: ReportPageVariant = "sale",
): BlurbLength {
  return resolveBlurbLengthForTemplate(templateId, collateral, copy);
}
