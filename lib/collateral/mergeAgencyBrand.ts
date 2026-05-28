import type { Agency } from "@/lib/types";
import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { buildAgencyBrandSlice } from "@/lib/collateral/buildAgencyBrandSlice";

export function mergeAgencyBrandIntoCollateralDocument(
  agency: Agency,
  document: CollateralDocumentJson,
): CollateralDocumentJson {
  return {
    ...document,
    agency: buildAgencyBrandSlice(agency),
  };
}
