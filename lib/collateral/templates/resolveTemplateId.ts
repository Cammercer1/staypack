import {
  DEFAULT_COLLATERAL_TEMPLATE_IDS,
  isValidCollateralTemplateId,
} from "@/lib/collateral/templates/ids";
import { getCollateralTemplatesForType } from "@/lib/collateral/templates/registry";
import type { CollateralTemplateDefaults } from "@/lib/collateral/templates/types";
import type { Agency, CollateralItem, CollateralType } from "@/lib/types";

export function resolveCollateralTemplateId(
  agency: Agency,
  item: Pick<CollateralItem, "type" | "template_id">,
): string {
  if (item.template_id && isValidCollateralTemplateId(item.template_id)) {
    return item.template_id;
  }

  const defaults =
    (agency.collateral_template_defaults as CollateralTemplateDefaults | null) ??
    {};

  const agencyDefault = defaults[item.type as CollateralType];
  if (agencyDefault && isValidCollateralTemplateId(agencyDefault)) {
    return agencyDefault;
  }

  const platformDefault =
    DEFAULT_COLLATERAL_TEMPLATE_IDS[
      item.type as keyof typeof DEFAULT_COLLATERAL_TEMPLATE_IDS
    ];

  if (platformDefault) {
    return platformDefault;
  }

  return getCollateralTemplatesForType(item.type)[0]?.id ?? "business-card-classic";
}

export function resolveTemplateIdFromDocument(
  document: { template_id?: string | null },
  fallbackType: CollateralType,
): string {
  if (
    document.template_id &&
    isValidCollateralTemplateId(document.template_id)
  ) {
    return document.template_id;
  }

  return DEFAULT_COLLATERAL_TEMPLATE_IDS[
    fallbackType as keyof typeof DEFAULT_COLLATERAL_TEMPLATE_IDS
  ];
}
