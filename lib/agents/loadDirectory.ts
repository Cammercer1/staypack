import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentProfile, Listing } from "@/lib/types";
import { agentListingUsage, type AgentDirectoryEntry } from "./directory";

export async function loadAgentDirectory(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<AgentDirectoryEntry[]> {
  const [agents, listings] = await Promise.all([
    supabase
      .from("agent_profiles")
      .select("*")
      .eq("agency_id", agencyId)
      .order("name"),
    supabase
      .from("listings")
      .select(
        "id,property_address,listing_title,agent_profile_id,scraped_listing_json",
      )
      .eq("agency_id", agencyId),
  ]);
  if (agents.error || listings.error)
    throw new Error(
      "Could not load agents and their linked listings. Please try again.",
    );
  return (agents.data as AgentProfile[]).map((agent) => ({
    ...agent,
    listings: agentListingUsage(agent, listings.data as Listing[]),
  }));
}
