import type { AgentProfile, Report } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadReportAgent(
  supabase: SupabaseClient,
  report: Report,
): Promise<AgentProfile | null> {
  if (report.agent_profile_id) {
    const { data } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("id", report.agent_profile_id)
      .maybeSingle();

    if (data) {
      return data as AgentProfile;
    }
  }

  const { data: defaultAgent } = await supabase
    .from("agent_profiles")
    .select("*")
    .eq("agency_id", report.agency_id)
    .eq("is_default", true)
    .maybeSingle();

  return (defaultAgent as AgentProfile | null) ?? null;
}
