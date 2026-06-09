import { agentProfileFromBrand } from "@/lib/delivery/brand/agentFromBrand";
import type { DeliveryTenantBrand } from "@/lib/delivery/brand/schema";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import {
  resolveAgencyAccountReportAgents,
  resolveReportAgents,
  type ReportAgent,
} from "@/lib/reports/resolveReportAgents";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency, AgentProfile, Listing, ParsedListing } from "@/lib/types";

export type OutreachAgentSource = "profile" | "listing" | "brand";

export type ResolveOutreachAgentsResult = {
  agents: ReportAgent[];
  agentProfile: AgentProfile | null;
  agentSource: OutreachAgentSource;
};

export async function resolveOutreachAgents({
  agency,
  listing,
  parsed,
  tenantBrand,
  agentProfileIds,
  agencyAgents: agencyAgentsInput,
}: {
  agency: Agency;
  listing: Listing;
  parsed: ParsedListing;
  tenantBrand?: DeliveryTenantBrand | null;
  agentProfileIds?: string[];
  agencyAgents?: AgentProfile[];
}): Promise<ResolveOutreachAgentsResult> {
  const admin = createAdminClient();
  const agencyAgents =
    agencyAgentsInput ?? (await loadAgencyAgentProfiles(admin, agency.id));

  if (agentProfileIds?.length) {
    const ids = agentProfileIds.slice(0, 2);
    const profiles = agencyAgents.filter((profile) => ids.includes(profile.id));

    if (profiles.length !== ids.length) {
      const missing = ids.filter((id) => !profiles.some((p) => p.id === id));
      throw new Error(
        `Agent profile(s) not found for this agency: ${missing.join(", ")}`,
      );
    }

    const ordered = ids
      .map((id) => profiles.find((p) => p.id === id))
      .filter((p): p is AgentProfile => p != null);

    const agentProfile = ordered[0] ?? null;
    const agents = resolveAgencyAccountReportAgents({
      agentProfile,
      agencyAgents: ordered,
    });

    return {
      agents,
      agentProfile,
      agentSource: "profile",
    };
  }

  const brandAgent = agentProfileFromBrand(agency.id, tenantBrand);
  const agents = resolveReportAgents({
    scraped: parsed,
    agentProfile: listing.agent_profile_id
      ? agencyAgents.find((a) => a.id === listing.agent_profile_id) ?? brandAgent
      : brandAgent,
    agencyAgents,
  });

  if (agents.length > 0 && parsed.agents?.length) {
    return {
      agents,
      agentProfile:
        agencyAgents.find((a) => a.id === listing.agent_profile_id) ?? brandAgent,
      agentSource: "listing",
    };
  }

  if (brandAgent) {
    const fromBrand = resolveReportAgents({
      scraped: null,
      agentProfile: brandAgent,
      agencyAgents,
    });

    return {
      agents: fromBrand,
      agentProfile: brandAgent,
      agentSource: "brand",
    };
  }

  return {
    agents: [],
    agentProfile: null,
    agentSource: "brand",
  };
}
