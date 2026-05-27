import { sanitizeAgentPhone } from "@/lib/agents/agentContact";
import { MAX_LISTING_AGENTS } from "@/lib/reports/constants";
import type { AgentProfile, ParsedListing } from "@/lib/types";

export type ListingAgentDraft = {
  name: string;
  email: string;
  phone: string;
  role_title: string;
  photo_url: string;
};

export const EMPTY_LISTING_AGENT: ListingAgentDraft = {
  name: "",
  email: "",
  phone: "",
  role_title: "",
  photo_url: "",
};

export function listingAgentFromScraped(
  agent: ParsedListing["agents"][number],
): ListingAgentDraft {
  return {
    name: agent.name?.trim() ?? "",
    email: agent.email?.trim() ?? "",
    phone: sanitizeAgentPhone(agent.phone),
    role_title: agent.role_title?.trim() ?? "",
    photo_url: agent.photo_url?.trim() ?? "",
  };
}

export function listingAgentFromProfile(agent: AgentProfile): ListingAgentDraft {
  return {
    name: agent.name,
    email: agent.email ?? "",
    phone: sanitizeAgentPhone(agent.phone),
    role_title: agent.role_title ?? "",
    photo_url: agent.photo_url ?? "",
  };
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function listingAgentMatchesDraft(
  left: ListingAgentDraft,
  right: ListingAgentDraft,
) {
  if (normalizeName(left.name) && normalizeName(left.name) === normalizeName(right.name)) {
    return true;
  }

  if (left.email.trim() && right.email.trim()) {
    return normalizeEmail(left.email) === normalizeEmail(right.email);
  }

  const leftPhone = normalizePhone(left.phone);
  const rightPhone = normalizePhone(right.phone);
  if (leftPhone.length >= 8 && leftPhone === rightPhone) {
    return true;
  }

  return false;
}

export function listingAgentAlreadyAttached(
  candidate: ListingAgentDraft,
  agents: ListingAgentDraft[],
) {
  return agents.some((agent) => listingAgentMatchesDraft(agent, candidate));
}

export function initialListingAgents(
  scrapedAgents: ParsedListing["agents"] | undefined,
): ListingAgentDraft[] {
  const fromScrape = (scrapedAgents ?? [])
    .map(listingAgentFromScraped)
    .filter((agent) => agent.name)
    .slice(0, MAX_LISTING_AGENTS);

  return fromScrape.length > 0 ? fromScrape : [];
}

export function sanitizeListingAgents(agents: ListingAgentDraft[]) {
  return agents
    .map((agent) => ({
      name: agent.name.trim(),
      email: agent.email.trim() || undefined,
      phone: sanitizeAgentPhone(agent.phone) || undefined,
      role_title: agent.role_title.trim() || undefined,
      photo_url: agent.photo_url.trim() || undefined,
    }))
    .filter((agent) => agent.name)
    .slice(0, MAX_LISTING_AGENTS);
}

export function listingAgentsToParsed(
  agents: ListingAgentDraft[],
): ParsedListing["agents"] {
  return sanitizeListingAgents(agents);
}
