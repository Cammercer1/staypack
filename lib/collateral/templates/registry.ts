import { BUSINESS_CARD_TEMPLATES } from "@/lib/collateral/templates/business-card/registry";
import {
  DEFAULT_COLLATERAL_TEMPLATE_IDS,
  isValidCollateralTemplateId,
} from "@/lib/collateral/templates/ids";
import type { CollateralTemplateDefinition } from "@/lib/collateral/templates/types";
import type { CollateralType } from "@/lib/types";

export const COLLATERAL_TEMPLATES: CollateralTemplateDefinition[] = [
  ...BUSINESS_CARD_TEMPLATES,
];

export function getCollateralTemplate(id: string): CollateralTemplateDefinition {
  const template = COLLATERAL_TEMPLATES.find((entry) => entry.id === id);
  if (template) return template;

  return COLLATERAL_TEMPLATES[0];
}

export function getCollateralTemplatesForType(type: CollateralType) {
  return COLLATERAL_TEMPLATES.filter((entry) => entry.collateralType === type);
}

export function getDefaultCollateralTemplateId(type: CollateralType) {
  return (
    DEFAULT_COLLATERAL_TEMPLATE_IDS[
      type as keyof typeof DEFAULT_COLLATERAL_TEMPLATE_IDS
    ] ?? COLLATERAL_TEMPLATES[0]?.id
  );
}

export {
  DEFAULT_COLLATERAL_TEMPLATE_IDS,
  isValidCollateralTemplateId,
};
