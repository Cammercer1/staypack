import { MAX_LISTING_AGENTS } from "@/lib/reports/constants";
import { sanitizeAgentPhone } from "@/lib/agents/agentContact";
import { enrichScrapedAgentsWithProfiles } from "@/lib/agents/enrichScrapedAgents";
import type { AgentProfile, ParsedListing } from "@/lib/types";

export type ReportAgent = {
  name: string;
  role_title: string;
  phone: string;
  email: string;
  photo_url: string;
};

export const EMPTY_REPORT_AGENT: ReportAgent = {
  name: "",
  role_title: "",
  phone: "",
  email: "",
  photo_url: "",
};

function normalizeScrapedAgent(
  agent: ParsedListing["agents"][number],
): ReportAgent | null {
  const name = agent.name?.trim();
  if (!name) {
    return null;
  }

  return {
    name,
    role_title: agent.role_title?.trim() ?? "",
    phone: sanitizeAgentPhone(agent.phone?.trim()) || "",
    email: agent.email?.trim() ?? "",
    photo_url: agent.photo_url?.trim() ?? "",
  };
}

function normalizeProfileAgent(agent: AgentProfile): ReportAgent {
  return {
    name: agent.name,
    role_title: agent.role_title ?? "",
    phone: sanitizeAgentPhone(agent.phone) || "",
    email: agent.email ?? "",
    photo_url: agent.photo_url ?? "",
  };
}

/** Agency roster + listing assignment — ignores scraped REA agent cards. */
export function resolveAgencyAccountReportAgents({
  agentProfile,
  agencyAgents = [],
}: {
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
}): ReportAgent[] {
  const primary =
    agentProfile ??
    agencyAgents.find((agent) => agent.is_default) ??
    agencyAgents[0] ??
    null;

  if (!primary) {
    return [];
  }

  const ordered: AgentProfile[] = [primary];
  for (const agent of agencyAgents) {
    if (agent.id === primary.id || ordered.length >= MAX_LISTING_AGENTS) {
      continue;
    }
    ordered.push(agent);
  }

  return ordered.map(normalizeProfileAgent);
}

export function resolveReportAgents({
  scraped,
  agentProfile,
  agencyAgents,
}: {
  scraped?: ParsedListing | null;
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
}): ReportAgent[] {
  const scrapedAgents = agencyAgents?.length
    ? enrichScrapedAgentsWithProfiles(scraped?.agents, agencyAgents)
    : (scraped?.agents ?? []);

  const fromScrape = scrapedAgents
    .map(normalizeScrapedAgent)
    .filter((agent): agent is ReportAgent => agent != null);

  if (fromScrape.length > 0) {
    return fromScrape.slice(0, MAX_LISTING_AGENTS);
  }

  if (agentProfile) {
    return [normalizeProfileAgent(agentProfile)];
  }

  return [];
}

export function primaryReportAgent(agents: ReportAgent[]): ReportAgent {
  return agents[0] ?? EMPTY_REPORT_AGENT;
}
