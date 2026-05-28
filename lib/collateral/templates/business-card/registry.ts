import { ClassicBusinessCard } from "@/lib/collateral/templates/business-card/classic/ClassicBusinessCard";
import { BUSINESS_CARD_CLASSIC_TEMPLATE_ID } from "@/lib/collateral/templates/ids";
import type { CollateralTemplateDefinition } from "@/lib/collateral/templates/types";

export const BUSINESS_CARD_TEMPLATES: CollateralTemplateDefinition[] = [
  {
    id: BUSINESS_CARD_CLASSIC_TEMPLATE_ID,
    collateralType: "agent_business_card",
    label: "Classic",
    description: "Standard 90 × 55 mm card with agent details and property QR code.",
    pageFormat: "business-card-au",
    pages: 1,
    Component: ClassicBusinessCard,
  },
];
