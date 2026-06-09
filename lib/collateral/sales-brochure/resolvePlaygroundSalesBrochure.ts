import {
  buildSalesBrochureDocument,
  getMockSalesBrochureCopy,
} from "@/lib/collateral/buildSalesBrochureDocument";
import { enrichSalesBrochureDocumentAgents } from "@/lib/collateral/enrichSalesBrochureDocument";
import { mergeAgencyBrandIntoCollateralDocument } from "@/lib/collateral/mergeAgencyBrand";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import type { Agency, CollateralItem, Listing } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ResolveInput = {
  supabase: SupabaseClient;
  agency: Agency;
  listing: Listing;
  collateral?: CollateralItem | null;
};

export async function resolvePlaygroundSalesBrochure({
  supabase,
  agency,
  listing,
  collateral,
}: ResolveInput): Promise<BrochureDocumentJson> {
  const agentProfile = await loadListingAgentProfile(supabase, listing);
  const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);

  if (
    collateral?.document_json &&
    isBrochureDocument(collateral.document_json)
  ) {
    const branded = mergeAgencyBrandIntoCollateralDocument(
      agency,
      collateral.document_json,
    ) as BrochureDocumentJson;

    return enrichSalesBrochureDocumentAgents(branded, listing, {
      agentProfile,
      agencyAgents,
    });
  }
  const templateId = collateral
    ? resolveCollateralTemplateId(agency, collateral)
    : createPlaygroundSalesBrochureDocument().template_id;

  const copy = getMockSalesBrochureCopy(listing, agency);

  if (collateral || listing.scraped_listing_json) {
    const collateralRow: CollateralItem =
      collateral ??
      ({
        id: "",
        listing_id: listing.id,
        agency_id: agency.id,
        type: "sales_brochure",
        status: "draft",
        template_id: null,
        report_id: null,
        document_json: null,
        public_slug: null,
        public_url: null,
        pdf_url: null,
        qr_code_url: null,
        generated_at: null,
        published_at: null,
        created_at: "",
        updated_at: "",
      } as CollateralItem);

    return buildSalesBrochureDocument({
      agency,
      listing,
      collateral: { ...collateralRow, template_id: templateId },
      copy,
      agentProfile,
      agencyAgents,
      qrCodeUrl: createPlaygroundSalesBrochureDocument().assets.qr_code_url,
      qrTargetUrl: "https://example.com/listing",
    });
  }

  return createPlaygroundSalesBrochureDocument(templateId);
}
