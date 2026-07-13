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

function isAccountTemplateId(templateId: string): boolean {
  return (
    templateId.startsWith("haven-properties") ||
    templateId.startsWith("belle-property")
  );
}

function isHavenTemplateId(templateId: string): boolean {
  return templateId.startsWith("haven-properties");
}

function isBelleTemplateId(templateId: string): boolean {
  return templateId.startsWith("belle-property");
}

function isBelleBrochureTemplateId(templateId: string): boolean {
  return templateId.startsWith("sales-brochure-belle");
}

function reportProduct(templateId: string): TemplateProduct {
  if (templateId.includes("sales-appraisal")) return "sales_appraisal";
  return templateId.includes("lease-appraisal") ? "lease" : "str";
}

function reportScope(templateId: string): TemplateScope {
  return isAccountTemplateId(templateId) ? "account" : "platform";
}

function reportBrandMode(templateId: string): TemplateBrandMode {
  return isAccountTemplateId(templateId) ? "fixed" : "agency";
}

function fixedBrandKitIdForReport(templateId: string): string | undefined {
  if (isHavenTemplateId(templateId)) return "haven";
  if (isBelleTemplateId(templateId)) return "belle";
  return undefined;
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
  const isBelle = isBelleTemplateId(template.id);

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
    defaultBlurbLength: isHaven || isBelle
      ? "long"
      : defaultBlurbLengthForFamily(family),
    blurbLengthLocked: locked,
    fixedBrandKitId: fixedBrandKitIdForReport(template.id),
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
  const isBelle = isBelleBrochureTemplateId(template.id);

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
    scope: isBelle ? "account" : "platform",
    brandMode: isBelle ? "fixed" : "agency",
    defaultBlurbLength: isBelle ? "long" : defaultBlurbLengthForFamily(family),
    blurbLengthLocked: locked,
    fixedBrandKitId: isBelle ? "belle" : undefined,
  };
}
