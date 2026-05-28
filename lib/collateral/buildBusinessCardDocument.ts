import { buildAgencyBrandSlice } from "@/lib/collateral/buildAgencyBrandSlice";
import { resolveCollateralImageSelection } from "@/lib/listings/collateralImages";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import type { BusinessCardDocumentJson } from "@/lib/collateral/templates/types";
import {
  primaryReportAgent,
  resolveReportAgents,
} from "@/lib/reports/resolveReportAgents";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
} from "@/lib/types";

type BuildBusinessCardInput = {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
  qrCodeUrl: string;
  qrTargetUrl: string;
};

export function buildBusinessCardDocument({
  agency,
  listing,
  collateral,
  agentProfile,
  agencyAgents,
  qrCodeUrl,
  qrTargetUrl,
}: BuildBusinessCardInput): BusinessCardDocumentJson {
  const scraped = listing.scraped_listing_json;
  const agents = resolveReportAgents({
    scraped,
    agentProfile,
    agencyAgents,
  });
  const agent = primaryReportAgent(agents);

  const cardImages = resolveCollateralImageSelection(listing, "agent_business_card");

  return {
    version: "business_card_v1",
    type: "agent_business_card",
    template_id: resolveCollateralTemplateId(agency, collateral),
    generated_at: new Date().toISOString(),
    agency: buildAgencyBrandSlice(agency),
    listing: {
      address:
        listing.property_address ??
        scraped?.address ??
        listing.listing_title ??
        "Property",
      suburb: listing.suburb ?? scraped?.suburb ?? "",
      display_price: listing.display_price ?? scraped?.displayPrice ?? "",
      hero_image_url:
        cardImages.hero_image_url ??
        cardImages.selected_image_urls[0] ??
        listing.hero_image_url ??
        listing.selected_image_urls?.[0] ??
        scraped?.images?.[0] ??
        "",
    },
    agent: {
      name: agent.name,
      role_title: agent.role_title,
      phone: agent.phone,
      email: agent.email,
      photo_url: agent.photo_url,
    },
    qr_target_url: qrTargetUrl,
    assets: {
      qr_code_url: qrCodeUrl,
    },
  };
}
