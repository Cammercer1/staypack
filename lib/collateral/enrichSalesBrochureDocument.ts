import { mergeAgencyBrandIntoCollateralDocument } from "@/lib/collateral/mergeAgencyBrand";
import { applyFixedBrandKitToBrochureDocument } from "@/lib/collateral/applyFixedBrandKitToBrochureDocument";
import { SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID } from "@/lib/collateral/templates/ids";
import { loadClassicBrochureMetricsForListing } from "@/lib/collateral/templates/sales-brochure/shared/loadClassicBrochureMetricsForListing";
import {
  isBrochureDocument,
  type BrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import {
  primaryReportAgent,
  resolveReportAgents,
} from "@/lib/reports/resolveReportAgents";
import { resolveListingImageMetaForPool } from "@/lib/listings/syncListingImageMeta";
import type {
  Agency,
  AgentProfile,
  CollateralDocumentJson,
  FinalReportJson,
  Listing,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export function enrichSalesBrochureDocumentAgents(
  document: BrochureDocumentJson,
  listing: Pick<Listing, "scraped_listing_json" | "agent_profile_id">,
  options?: {
    agentProfile?: AgentProfile | null;
    agencyAgents?: AgentProfile[];
  },
): BrochureDocumentJson {
  const agents = resolveReportAgents({
    scraped: listing.scraped_listing_json,
    agentProfile: options?.agentProfile,
    agencyAgents: options?.agencyAgents,
  });

  if (!agents.length) {
    return document;
  }

  const agent = primaryReportAgent(agents);

  return {
    ...document,
    agent: {
      name: agent.name,
      role_title: agent.role_title,
      phone: agent.phone,
      email: agent.email,
      photo_url: agent.photo_url,
    },
    agents: agents.map((entry) => ({
      name: entry.name,
      role_title: entry.role_title,
      phone: entry.phone,
      email: entry.email,
      photo_url: entry.photo_url,
    })),
  };
}

export async function resolveSalesBrochurePrintDocument({
  admin,
  agency,
  collateral,
}: {
  admin: SupabaseClient;
  agency: Agency;
  collateral: {
    document_json: CollateralDocumentJson;
    listing_id: string | null;
    agency_id: string;
    template_id?: string | null;
  };
}): Promise<CollateralDocumentJson> {
  let document = mergeAgencyBrandIntoCollateralDocument(agency, collateral.document_json);

  if (!collateral.listing_id || !isBrochureDocument(document)) {
    return document;
  }

  const { data: listing } = await admin
    .from("listings")
    .select("scraped_listing_json, agent_profile_id, uploaded_image_urls, listing_image_meta")
    .eq("id", collateral.listing_id)
    .maybeSingle();

  if (!listing) {
    return document;
  }

  const agencyAgents = (await loadAgencyAgentProfiles(
    admin,
    collateral.agency_id,
  )) as AgentProfile[];
  const agentProfile =
    listing.agent_profile_id != null
      ? agencyAgents.find((agent) => agent.id === listing.agent_profile_id) ?? null
      : agencyAgents.find((agent) => agent.is_default) ?? agencyAgents[0] ?? null;

  const withAgents = enrichSalesBrochureDocumentAgents(
    document,
    listing as Pick<Listing, "scraped_listing_json" | "agent_profile_id">,
    { agencyAgents, agentProfile },
  );

  if (!isBrochureDocument(withAgents)) {
    return withAgents;
  }

  const withMeta = {
    ...withAgents,
    listing_image_meta: resolveListingImageMetaForPool(
      listing as Pick<
        Listing,
        "scraped_listing_json" | "uploaded_image_urls" | "listing_image_meta"
      >,
    ),
  };

  if (collateral.template_id) {
    return applyFixedBrandKitToBrochureDocument(withMeta, collateral.template_id);
  }

  return withMeta;
}

export async function resolveBrochurePrintDocument(
  input: Parameters<typeof resolveSalesBrochurePrintDocument>[0],
): Promise<CollateralDocumentJson> {
  return resolveSalesBrochurePrintDocument(input);
}

export type BrochurePrintContext = {
  document: CollateralDocumentJson;
  metricsReport?: FinalReportJson;
};

/** Print/PDF payload: enriched brochure document plus Classic page-one STR/lease metrics when available. */
export async function resolveBrochurePrintContext(
  input: Parameters<typeof resolveSalesBrochurePrintDocument>[0],
): Promise<BrochurePrintContext> {
  const document = await resolveSalesBrochurePrintDocument(input);

  if (
    !input.collateral.listing_id ||
    !isBrochureDocument(document) ||
    document.template_id !== SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID
  ) {
    return { document };
  }

  const { data: listing } = await input.admin
    .from("listings")
    .select("*")
    .eq("id", input.collateral.listing_id)
    .maybeSingle();

  if (!listing) {
    return { document };
  }

  const metricsReport = await loadClassicBrochureMetricsForListing({
    admin: input.admin,
    agency: input.agency,
    listing: listing as Listing,
    listingId: input.collateral.listing_id,
  });

  return metricsReport ? { document, metricsReport } : { document };
}

export const enrichBrochureDocumentAgents = enrichSalesBrochureDocumentAgents;
