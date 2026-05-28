import { buildSalesBrochureDocument } from "@/lib/collateral/buildSalesBrochureDocument";
import { getMockSalesBrochureCopy } from "@/lib/collateral/buildSalesBrochureDocument";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
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
}: ResolveInput): Promise<SalesBrochureDocumentJson> {
  if (
    collateral?.document_json &&
    isSalesBrochureDocument(collateral.document_json)
  ) {
    return collateral.document_json;
  }

  const agentProfile = await loadListingAgentProfile(supabase, listing);
  const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);
  const templateId = collateral
    ? resolveCollateralTemplateId(agency, collateral)
    : createPlaygroundSalesBrochureDocument().template_id;

  const copy = getMockSalesBrochureCopy(listing, agency);

  if (collateral) {
    return buildSalesBrochureDocument({
      agency,
      listing,
      collateral: { ...collateral, template_id: templateId },
      copy,
      agentProfile,
      agencyAgents,
      qrCodeUrl: createPlaygroundSalesBrochureDocument().assets.qr_code_url,
      qrTargetUrl: "https://example.com/listing",
    });
  }

  return createPlaygroundSalesBrochureDocument(templateId);
}
