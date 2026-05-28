import { buildBusinessCardDocument } from "@/lib/collateral/buildBusinessCardDocument";
import {
  buildSalesBrochureDocument,
  getMockSalesBrochureCopy,
} from "@/lib/collateral/buildSalesBrochureDocument";
import { buildSocialPostsDocument } from "@/lib/collateral/buildSocialPostsDocument";
import { provisionCollateralQr } from "@/lib/collateral/provisionCollateralQr";
import {
  isSalesBrochureDocument,
  type CollateralDocumentJson,
  type SalesBrochureCopyJson,
} from "@/lib/collateral/templates/types";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type GenerateInput = {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  supabase: SupabaseClient;
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
};

export async function generateCollateralDocument({
  agency,
  listing,
  collateral,
  supabase,
  agentProfile,
  agencyAgents,
}: GenerateInput): Promise<CollateralDocumentJson> {
  if (collateral.type === "social_posts") {
    return buildSocialPostsDocument({
      agency,
      listing,
      collateral,
      agentProfile,
      agencyAgents,
    });
  }

  const { provisionedListing, qrCodeUrl, qrTargetUrl } =
    await provisionCollateralQr({
      agency,
      listing,
      collateral,
      supabase,
    });

  switch (collateral.type) {
    case "agent_business_card":
      return buildBusinessCardDocument({
        agency,
        listing: provisionedListing,
        collateral,
        agentProfile,
        agencyAgents,
        qrCodeUrl,
        qrTargetUrl,
      });
    case "sales_brochure": {
      const existingCopy =
        collateral.document_json && isSalesBrochureDocument(collateral.document_json)
          ? collateral.document_json.copy
          : null;
      const copy: SalesBrochureCopyJson =
        existingCopy ?? getMockSalesBrochureCopy(provisionedListing, agency);

      return buildSalesBrochureDocument({
        agency,
        listing: provisionedListing,
        collateral,
        copy,
        agentProfile,
        agencyAgents,
        qrCodeUrl,
        qrTargetUrl,
      });
    }
    default:
      throw new Error(`${collateral.type} generation is not implemented yet`);
  }
}
