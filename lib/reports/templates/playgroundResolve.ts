import { salesBrochureTemplateIdForFamily } from "@/lib/reports/templates/salesBrochureFamilyMap";
import {
  getReportTemplateDevSources,
  REPORT_FAMILY_PAGE_ONE_SOURCES,
} from "@/lib/reports/templates/devSources";
import { SALES_BROCHURE_DEV_SOURCES } from "@/lib/collateral/templates/sales-brochure/devSources";
import { getReportTemplate } from "@/lib/reports/templates/registry";
import { getCollateralTemplate } from "@/lib/collateral/templates/registry";
import { HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";

export const PLAYGROUND_LAYOUT_FAMILIES = [
  { id: "classic", label: "Classic" },
  { id: "bold", label: "Bold" },
  { id: "gallery", label: "Gallery" },
  { id: "editorial", label: "Editorial" },
  { id: "split", label: "Split" },
  { id: "refined", label: "Refined" },
  { id: "minimalist", label: "Minimalist" },
  { id: "landmark", label: "Landmark" },
] as const;

export type PlaygroundLayoutFamilyId = (typeof PLAYGROUND_LAYOUT_FAMILIES)[number]["id"];

export function resolvePlaygroundTemplateId(
  collateral: ReportPageVariant,
  family: string,
  pages: 1 | 2,
): string {
  if (collateral === "sale") {
    return salesBrochureTemplateIdForFamily(family, pages);
  }
  if (collateral === "lease") {
    if (family === "haven-properties") {
      return HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID;
    }
    const id = `${family}-lease-appraisal`;
    return isLeaseAppraisalTemplateId(id) ? id : "classic-lease-appraisal";
  }
  return `${family}-detailed`;
}

export function resolvePlaygroundMeta(
  collateral: ReportPageVariant,
  family: string,
  pages: 1 | 2,
) {
  const templateId = resolvePlaygroundTemplateId(collateral, family, pages);
  const sourceFiles = getReportTemplateDevSources(family, collateral, templateId);
  const primaryFile = pickPrimarySourceFile(
    sourceFiles,
    family,
    collateral,
    templateId,
  );
  const template =
    collateral === "sale"
      ? getCollateralTemplate(templateId)
      : getReportTemplate(templateId);

  return {
    templateId,
    sourceFiles,
    primaryFile,
    label: template.label,
    pages: template.pages,
  };
}

function pickPrimarySourceFile(
  files: string[],
  family: string,
  collateral: ReportPageVariant,
  templateId: string,
): string {
  if (collateral === "sale") {
    const saleFiles = SALES_BROCHURE_DEV_SOURCES[templateId];
    if (saleFiles?.[0]) return saleFiles[0];
  }

  const familyPageOne = REPORT_FAMILY_PAGE_ONE_SOURCES[family];
  if (familyPageOne?.[0]) return familyPageOne[0];

  const prefer = files.find(
    (f) =>
      /PageOne\.tsx$/.test(f) ||
      /OnePage\.tsx$/.test(f) ||
      new RegExp(`${family}/[^/]+Template\\.tsx$`).test(f),
  );

  return prefer ?? files[0] ?? "";
}

export function familyFromTemplateId(
  templateId: string,
  collateral: ReportPageVariant,
): PlaygroundLayoutFamilyId {
  if (templateId.includes("haven-properties")) {
    return "classic";
  }
  const brochureMatch = templateId.match(/^(?:sales|rental)-brochure-(.+)-(1pg|2pg)$/);
  if (brochureMatch?.[1] && PLAYGROUND_LAYOUT_FAMILIES.some((f) => f.id === brochureMatch[1])) {
    return brochureMatch[1] as PlaygroundLayoutFamilyId;
  }
  if (collateral === "lease" || templateId.includes("lease-appraisal")) {
    const id = templateId.replace(/-lease-appraisal$/, "");
    if (PLAYGROUND_LAYOUT_FAMILIES.some((f) => f.id === id)) {
      return id as PlaygroundLayoutFamilyId;
    }
  }
  const id = templateId.replace(/-(?:light|detailed)$/, "");
  if (PLAYGROUND_LAYOUT_FAMILIES.some((f) => f.id === id)) {
    return id as PlaygroundLayoutFamilyId;
  }
  return "classic";
}

export function pagesFromTemplateId(
  templateId: string,
  collateral: ReportPageVariant,
): 1 | 2 {
  if (collateral === "sale") {
    return templateId.endsWith("-2pg") ? 2 : 1;
  }
  if (collateral === "lease" || isLeaseAppraisalTemplateId(templateId)) {
    return 2;
  }
  return 2;
}
