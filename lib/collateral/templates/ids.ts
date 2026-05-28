export const BUSINESS_CARD_CLASSIC_TEMPLATE_ID = "business-card-classic";
export const SOCIAL_POST_BRANDED_TEMPLATE_ID = "social-post-branded";

export const SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID = "sales-brochure-classic-1pg";
export const SALES_BROCHURE_CLASSIC_2PG_TEMPLATE_ID = "sales-brochure-classic-2pg";
export const SALES_BROCHURE_EDITORIAL_1PG_TEMPLATE_ID = "sales-brochure-editorial-1pg";
export const SALES_BROCHURE_EDITORIAL_2PG_TEMPLATE_ID = "sales-brochure-editorial-2pg";
export const SALES_BROCHURE_GALLERY_1PG_TEMPLATE_ID = "sales-brochure-gallery-1pg";
export const SALES_BROCHURE_GALLERY_2PG_TEMPLATE_ID = "sales-brochure-gallery-2pg";
export const SALES_BROCHURE_SPLIT_1PG_TEMPLATE_ID = "sales-brochure-split-1pg";
export const SALES_BROCHURE_SPLIT_2PG_TEMPLATE_ID = "sales-brochure-split-2pg";
export const SALES_BROCHURE_BOLD_1PG_TEMPLATE_ID = "sales-brochure-bold-1pg";
export const SALES_BROCHURE_BOLD_2PG_TEMPLATE_ID = "sales-brochure-bold-2pg";
export const SALES_BROCHURE_REFINED_1PG_TEMPLATE_ID = "sales-brochure-refined-1pg";
export const SALES_BROCHURE_REFINED_2PG_TEMPLATE_ID = "sales-brochure-refined-2pg";

export const SALES_BROCHURE_TEMPLATE_IDS = [
  SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID,
  SALES_BROCHURE_CLASSIC_2PG_TEMPLATE_ID,
  SALES_BROCHURE_EDITORIAL_1PG_TEMPLATE_ID,
  SALES_BROCHURE_EDITORIAL_2PG_TEMPLATE_ID,
  SALES_BROCHURE_GALLERY_1PG_TEMPLATE_ID,
  SALES_BROCHURE_GALLERY_2PG_TEMPLATE_ID,
  SALES_BROCHURE_SPLIT_1PG_TEMPLATE_ID,
  SALES_BROCHURE_SPLIT_2PG_TEMPLATE_ID,
  SALES_BROCHURE_BOLD_1PG_TEMPLATE_ID,
  SALES_BROCHURE_BOLD_2PG_TEMPLATE_ID,
  SALES_BROCHURE_REFINED_1PG_TEMPLATE_ID,
  SALES_BROCHURE_REFINED_2PG_TEMPLATE_ID,
] as const;

export const DEFAULT_COLLATERAL_TEMPLATE_IDS = {
  agent_business_card: BUSINESS_CARD_CLASSIC_TEMPLATE_ID,
  social_posts: SOCIAL_POST_BRANDED_TEMPLATE_ID,
  sales_brochure: SALES_BROCHURE_GALLERY_2PG_TEMPLATE_ID,
} as const;

export const COLLATERAL_TEMPLATE_IDS = [
  BUSINESS_CARD_CLASSIC_TEMPLATE_ID,
  SOCIAL_POST_BRANDED_TEMPLATE_ID,
  ...SALES_BROCHURE_TEMPLATE_IDS,
] as const;

export function isValidCollateralTemplateId(id: string) {
  return (COLLATERAL_TEMPLATE_IDS as readonly string[]).includes(id);
}

export function isSalesBrochureTemplateId(id: string) {
  return (SALES_BROCHURE_TEMPLATE_IDS as readonly string[]).includes(id);
}
