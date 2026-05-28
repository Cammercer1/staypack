import type { AgentProfile, Listing } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadAgencyAgentProfiles(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<AgentProfile[]> {
  const { data } = await supabase
    .from("agent_profiles")
    .select("*")
    .eq("agency_id", agencyId);

  return (data ?? []) as AgentProfile[];
}

export async function loadListingAgentProfile(
  supabase: SupabaseClient,
  listing: Listing,
): Promise<AgentProfile | null> {
  if (listing.agent_profile_id) {
    const { data } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("id", listing.agent_profile_id)
      .maybeSingle();

    if (data) {
      return data as AgentProfile;
    }
  }

  return null;
}
