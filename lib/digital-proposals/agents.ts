import type { AgentProfile } from "@/lib/types";
import { sanitizeAgentPhone } from "@/lib/agents/agentContact";
import { assetUrlSchema, type ProposalAgent, type ProposalData } from "./data";

export type ProposalAgentOption = ProposalAgent & { id: string };
export function proposalAgentOptions(profiles: AgentProfile[], agencyId: string): ProposalAgentOption[] {
  return profiles.filter(profile => profile.agency_id === agencyId && !profile.archived_at).map(profile => ({
    id: profile.id, name: profile.name, role: profile.role_title ?? "",
    phone: sanitizeAgentPhone(profile.phone) || "", email: profile.email ?? "",
    photoUrl: assetUrlSchema.safeParse(profile.photo_url ?? "").success ? profile.photo_url ?? "" : "",
  }));
}
/** Resolve only this account's selected agents; never accept contact fields from a draft. */
export function withProposalAgents(data: ProposalData, ids: string[], available: ProposalAgentOption[]): ProposalData {
  const agents = ids.flatMap(id => {
    const agent = available.find(item => item.id === id);
    return agent ? [{ name: agent.name, role: agent.role, phone: agent.phone, email: agent.email, photoUrl: agent.photoUrl }] : [];
  });
  return { ...data, agents, agent: { name: agents[0]?.name ?? "", role: agents[0]?.role ?? "" } };
}
