import {
  SALES_BROCHURE_BELLE_2PG_TEMPLATE_ID,
  SALES_BROCHURE_BOLD_1PG_TEMPLATE_ID,
  SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID,
  SALES_BROCHURE_EDITORIAL_1PG_TEMPLATE_ID,
  SALES_BROCHURE_GALLERY_1PG_TEMPLATE_ID,
  SALES_BROCHURE_LANDMARK_1PG_TEMPLATE_ID,
  SALES_BROCHURE_MINIMALIST_1PG_TEMPLATE_ID,
  SALES_BROCHURE_REFINED_1PG_TEMPLATE_ID,
  SALES_BROCHURE_SPLIT_1PG_TEMPLATE_ID,
  SALES_BROCHURE_BOLD_2PG_TEMPLATE_ID,
  SALES_BROCHURE_CLASSIC_2PG_TEMPLATE_ID,
  SALES_BROCHURE_EDITORIAL_2PG_TEMPLATE_ID,
  SALES_BROCHURE_GALLERY_2PG_TEMPLATE_ID,
  SALES_BROCHURE_MINIMALIST_2PG_TEMPLATE_ID,
  SALES_BROCHURE_REFINED_2PG_TEMPLATE_ID,
  SALES_BROCHURE_SPLIT_2PG_TEMPLATE_ID,
} from "@/lib/collateral/templates/ids";

const SALES_BROCHURE_1PG_BY_FAMILY: Record<string, string> = {
  classic: SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID,
  gallery: SALES_BROCHURE_GALLERY_1PG_TEMPLATE_ID,
  editorial: SALES_BROCHURE_EDITORIAL_1PG_TEMPLATE_ID,
  split: SALES_BROCHURE_SPLIT_1PG_TEMPLATE_ID,
  bold: SALES_BROCHURE_BOLD_1PG_TEMPLATE_ID,
  refined: SALES_BROCHURE_REFINED_1PG_TEMPLATE_ID,
  minimalist: SALES_BROCHURE_MINIMALIST_1PG_TEMPLATE_ID,
  landmark: SALES_BROCHURE_LANDMARK_1PG_TEMPLATE_ID,
};

const SALES_BROCHURE_2PG_BY_FAMILY: Record<string, string> = {
  classic: SALES_BROCHURE_CLASSIC_2PG_TEMPLATE_ID,
  gallery: SALES_BROCHURE_GALLERY_2PG_TEMPLATE_ID,
  editorial: SALES_BROCHURE_EDITORIAL_2PG_TEMPLATE_ID,
  split: SALES_BROCHURE_SPLIT_2PG_TEMPLATE_ID,
  bold: SALES_BROCHURE_BOLD_2PG_TEMPLATE_ID,
  refined: SALES_BROCHURE_REFINED_2PG_TEMPLATE_ID,
  minimalist: SALES_BROCHURE_MINIMALIST_2PG_TEMPLATE_ID,
};

export function salesBrochureFamilyFromTemplateId(templateId: string) {
  const match = templateId.match(/^(?:sales|rental)-brochure-(.+)-(1pg|2pg)$/);
  return match?.[1] ?? "classic";
}

export function salesBrochureTemplateIdForFamily(
  family: string,
  pages: 1 | 2 = 1,
) {
  const map = pages === 1 ? SALES_BROCHURE_1PG_BY_FAMILY : SALES_BROCHURE_2PG_BY_FAMILY;
  return map[family] ?? SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID;
}

/** Brochure template id used to resolve page-1 blurb length for STR / lease / sales appraisal reports. */
export function resolveBrochureTemplateIdForReport(
  reportTemplateId: string,
  variant: "str" | "lease" | "sale" | "sales_appraisal",
  layoutFamily?: string,
): string {
  if (reportTemplateId.startsWith("belle-property")) {
    return SALES_BROCHURE_BELLE_2PG_TEMPLATE_ID;
  }

  if (
    variant === "sale" &&
    /^(?:sales|rental)-brochure-.+-(?:1pg|2pg)$/.test(reportTemplateId)
  ) {
    return reportTemplateId;
  }

  const pages =
    variant === "lease" ||
    variant === "sales_appraisal" ||
    reportTemplateId.includes("lease-appraisal") ||
    reportTemplateId.includes("sales-appraisal")
      ? 2
      : 1;
  const family =
    layoutFamily ??
    (reportTemplateId.includes("haven-properties")
      ? "classic"
      : reportFamilyFromTemplateId(reportTemplateId));

  return salesBrochureTemplateIdForFamily(family, pages);
}

export function reportFamilyFromTemplateId(templateId: string) {
  if (templateId.includes("lease-appraisal")) {
    return templateId.replace(/-lease-appraisal$/, "");
  }
  if (templateId.includes("sales-appraisal")) {
    return templateId.replace(/-sales-appraisal$/, "");
  }
  return templateId.replace(/-(?:light|detailed)$/, "");
}
