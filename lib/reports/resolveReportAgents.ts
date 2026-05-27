import { MAX_LISTING_AGENTS } from "@/lib/reports/constants";
import { sanitizeAgentPhone } from "@/lib/agents/agentContact";
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

export function resolveReportAgents({
  scraped,
  agentProfile,
}: {
  scraped?: ParsedListing | null;
  agentProfile?: AgentProfile | null;
}): ReportAgent[] {
  const fromScrape = (scraped?.agents ?? [])
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
