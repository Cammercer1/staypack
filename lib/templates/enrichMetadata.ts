import type { CollateralTemplateDefinition } from "@/lib/collateral/templates/types";
import {
  defaultBlurbLengthForFamily,
  isBoldFamily,
} from "@/lib/templates/familyDefaults";
import type {
  CollateralTemplateCatalogEntry,
  ReportTemplateCatalogEntry,
  TemplateBrandMode,
  TemplateProduct,
  TemplateScope,
} from "@/lib/templates/types";
import { salesBrochureFamilyFromTemplateId } from "@/lib/reports/templates/salesBrochureFamilyMap";
import type { ReportTemplateDefinition } from "@/lib/reports/templates/types";

function isHavenTemplateId(templateId: string): boolean {
  return templateId.startsWith("haven-properties");
}

function reportProduct(templateId: string): TemplateProduct {
  return templateId.includes("lease-appraisal") ? "lease" : "str";
}

function reportScope(templateId: string): TemplateScope {
  return isHavenTemplateId(templateId) ? "account" : "platform";
}

function reportBrandMode(templateId: string): TemplateBrandMode {
  return isHavenTemplateId(templateId) ? "fixed" : "agency";
}

function brochureFamily(templateId: string): string {
  return salesBrochureFamilyFromTemplateId(templateId);
}

function brochureProduct(
  collateralType: CollateralTemplateDefinition["collateralType"],
): TemplateProduct {
  return collateralType === "rental_brochure" ? "rental_brochure" : "sales_brochure";
}

export function enrichReportTemplate(
  template: ReportTemplateDefinition,
): ReportTemplateCatalogEntry {
  const family = template.family;
  const locked = isBoldFamily(family);
  const isHaven = isHavenTemplateId(template.id);

  return {
    kind: "report",
    id: template.id,
    family: template.family,
    tier: template.tier,
    label: template.label,
    description: template.description,
    pages: template.pages,
    sourcePath: template.sourcePath,
    product: reportProduct(template.id),
    scope: reportScope(template.id),
    brandMode: reportBrandMode(template.id),
    defaultBlurbLength: isHaven
      ? "long"
      : defaultBlurbLengthForFamily(family),
    blurbLengthLocked: locked,
    fixedBrandKitId: isHaven ? "haven" : undefined,
  };
}

export function enrichBrochureTemplate(
  template: CollateralTemplateDefinition,
): CollateralTemplateCatalogEntry | null {
  if (
    template.collateralType !== "sales_brochure" &&
    template.collateralType !== "rental_brochure"
  ) {
    return null;
  }

  const family = brochureFamily(template.id);
  const locked = isBoldFamily(family);

  return {
    kind: "collateral",
    id: template.id,
    collateralType: template.collateralType,
    label: template.label,
    description: template.description,
    pageFormat: template.pageFormat,
    pages: template.pages,
    family,
    product: brochureProduct(template.collateralType),
    scope: "platform",
    brandMode: "agency",
    defaultBlurbLength: defaultBlurbLengthForFamily(family),
    blurbLengthLocked: locked,
  };
}
