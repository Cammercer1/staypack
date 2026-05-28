import type { Agency } from "@/lib/types";
import type {
  CollateralDocumentJson,
  SocialPostsDocumentJson,
} from "@/lib/collateral/templates/types";
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

export function mergeAgencyBrandIntoSocialPostsDocument(
  agency: Agency,
  document: SocialPostsDocumentJson,
): SocialPostsDocumentJson {
  return mergeAgencyBrandIntoCollateralDocument(
    agency,
    document,
  ) as SocialPostsDocumentJson;
}
