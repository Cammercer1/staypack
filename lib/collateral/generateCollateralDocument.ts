import { buildBusinessCardDocument } from "@/lib/collateral/buildBusinessCardDocument";
import {
  buildRentalBrochureDocument,
  buildSalesBrochureDocument,
  getMockRentalBrochureCopy,
  getMockSalesBrochureCopy,
} from "@/lib/collateral/buildSalesBrochureDocument";
import { buildSocialPostsDocument } from "@/lib/collateral/buildSocialPostsDocument";
import { provisionCollateralQr } from "@/lib/collateral/provisionCollateralQr";
import {
  isBrochureDocument,
  type BrochureCopyJson,
  type CollateralDocumentJson,
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
  listing: Listing | null;
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
    if (!listing) {
      throw new Error("Social posts require a listing");
    }

    return buildSocialPostsDocument({
      agency,
      listing,
      collateral,
      agentProfile,
      agencyAgents,
    });
  }

  const qr =
    listing != null
      ? await provisionCollateralQr({
          agency,
          listing,
          collateral,
          supabase,
        })
      : null;

  switch (collateral.type) {
    case "agent_business_card":
      return buildBusinessCardDocument({
        agency,
        listing: qr?.provisionedListing ?? listing,
        collateral,
        agentProfile,
        agencyAgents,
        qrCodeUrl: qr?.qrCodeUrl ?? "",
        qrTargetUrl: qr?.qrTargetUrl ?? "",
        qrListingId: qr?.provisionedListing.id ?? null,
      });
    case "sales_brochure": {
      if (!qr) {
        throw new Error("Sales brochures require a listing");
      }

      const existingCopy =
        collateral.document_json && isBrochureDocument(collateral.document_json)
          ? collateral.document_json.copy
          : null;
      const copy: BrochureCopyJson =
        existingCopy ?? getMockSalesBrochureCopy(qr.provisionedListing, agency);

      return buildSalesBrochureDocument({
        agency,
        listing: qr.provisionedListing,
        collateral,
        copy,
        agentProfile,
        agencyAgents,
        qrCodeUrl: qr.qrCodeUrl,
        qrTargetUrl: qr.qrTargetUrl,
      });
    }
    case "rental_brochure": {
      if (!qr) {
        throw new Error("Lease brochures require a listing");
      }

      const existingCopy =
        collateral.document_json && isBrochureDocument(collateral.document_json)
          ? collateral.document_json.copy
          : null;
      const copy: BrochureCopyJson =
        existingCopy ?? getMockRentalBrochureCopy(qr.provisionedListing, agency);

      return buildRentalBrochureDocument({
        agency,
        listing: qr.provisionedListing,
        collateral,
        copy,
        agentProfile,
        agencyAgents,
        qrCodeUrl: qr.qrCodeUrl,
        qrTargetUrl: qr.qrTargetUrl,
      });
    }
    default:
      throw new Error(`${collateral.type} generation is not implemented yet`);
  }
}
