export const BUSINESS_CARD_CLASSIC_TEMPLATE_ID = "business-card-classic";

export const DEFAULT_COLLATERAL_TEMPLATE_IDS = {
  agent_business_card: BUSINESS_CARD_CLASSIC_TEMPLATE_ID,
} as const;

export const COLLATERAL_TEMPLATE_IDS = [
  BUSINESS_CARD_CLASSIC_TEMPLATE_ID,
] as const;

export function isValidCollateralTemplateId(id: string) {
  return (COLLATERAL_TEMPLATE_IDS as readonly string[]).includes(id);
}
