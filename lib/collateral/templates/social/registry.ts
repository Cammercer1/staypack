import { BrandedSocialPost } from "@/lib/collateral/templates/social/branded/BrandedSocialPost";
import { SOCIAL_POST_BRANDED_TEMPLATE_ID } from "@/lib/collateral/templates/ids";
import type { CollateralTemplateDefinition } from "@/lib/collateral/templates/types";

export const SOCIAL_POST_TEMPLATES: CollateralTemplateDefinition[] = [
  {
    id: SOCIAL_POST_BRANDED_TEMPLATE_ID,
    collateralType: "social_posts",
    label: "Branded",
    description: "Property photo with agency logo and address overlay.",
    pageFormat: "a4-portrait",
    pages: 1,
    Component: BrandedSocialPost,
  },
];
