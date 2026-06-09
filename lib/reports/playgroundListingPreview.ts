import { enrichSalesBrochureDocumentAgents } from "@/lib/collateral/enrichSalesBrochureDocument";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import {
  loadAgencyAgentProfiles,
  loadListingAgentProfile,
} from "@/lib/reports/loadReportAgent";
import type { Agency, AgentProfile, FinalReportJson, Listing } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Listing fields needed client-side to resolve agents on brochure preview. */
export type PlaygroundListingPreview = Pick<
  Listing,
  | "scraped_listing_json"
  | "agent_profile_id"
  | "uploaded_image_urls"
  | "listing_image_meta"
>;

export function toPlaygroundListingPreview(listing: Listing): PlaygroundListingPreview {
  return {
    scraped_listing_json: listing.scraped_listing_json,
    agent_profile_id: listing.agent_profile_id,
    uploaded_image_urls: listing.uploaded_image_urls,
    listing_image_meta: listing.listing_image_meta,
  };
}

export async function loadPlaygroundListingAgents(
  supabase: SupabaseClient,
  agency: Agency,
  listing: Listing,
): Promise<{
  agentProfile: AgentProfile | null;
  agencyAgents: AgentProfile[];
}> {
  const [agentProfile, agencyAgents] = await Promise.all([
    loadListingAgentProfile(supabase, listing),
    loadAgencyAgentProfiles(supabase, agency.id),
  ]);

  return { agentProfile, agencyAgents };
}

export function enrichPlaygroundFinalReportAgents(
  listing: Listing,
  report: FinalReportJson,
  agents: { agentProfile: AgentProfile | null; agencyAgents: AgentProfile[] },
): FinalReportJson {
  return enrichFinalReportMetrics(listing, report, {
    agentProfile: agents.agentProfile,
    agencyAgents: agents.agencyAgents,
  });
}

export function enrichPlaygroundSalesBrochureAgents(
  listing: Pick<Listing, "scraped_listing_json" | "agent_profile_id">,
  document: BrochureDocumentJson,
  agents: { agentProfile: AgentProfile | null; agencyAgents: AgentProfile[] },
): BrochureDocumentJson {
  return enrichSalesBrochureDocumentAgents(document, listing, {
    agentProfile: agents.agentProfile,
    agencyAgents: agents.agencyAgents,
  });
}
