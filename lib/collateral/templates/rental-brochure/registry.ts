import { SALES_BROCHURE_TEMPLATES } from "@/lib/collateral/templates/sales-brochure/registry";
import type { CollateralTemplateDefinition } from "@/lib/collateral/templates/types";

function rentalTemplateId(salesId: string): string {
  return salesId.replace(/^sales-brochure-/, "rental-brochure-");
}

export const RENTAL_BROCHURE_TEMPLATES: CollateralTemplateDefinition[] =
  SALES_BROCHURE_TEMPLATES.map((template) => ({
    ...template,
    id: rentalTemplateId(template.id),
    collateralType: "rental_brochure",
  }));

export function getRentalBrochureTemplatesByPageCount(pages: 1 | 2) {
  return RENTAL_BROCHURE_TEMPLATES.filter((template) => template.pages === pages);
}
