import {
  agentProfileMatchesScraped,
  scrapedAgentCandidates,
} from "@/lib/agents/matchScrapedAgents";
import type { AgentProfile, ParsedListing } from "@/lib/types";

function pickAgentField(
  scrapedValue: string | undefined,
  profileValue: string | null | undefined,
) {
  return scrapedValue?.trim() || profileValue?.trim() || undefined;
}

export function enrichScrapedAgentsWithProfiles(
  scrapedAgents: ParsedListing["agents"] | undefined,
  agencyAgents: AgentProfile[],
): ParsedListing["agents"] {
  if (!agencyAgents.length) {
    return scrapedAgents ?? [];
  }

  return scrapedAgentCandidates(scrapedAgents).map((scraped) => {
    const profile = agencyAgents.find((candidate) =>
      agentProfileMatchesScraped(candidate, scraped),
    );

    if (!profile) {
      return scraped;
    }

    return {
      ...scraped,
      email: pickAgentField(scraped.email, profile.email),
      phone: pickAgentField(scraped.phone, profile.phone),
      photo_url: pickAgentField(scraped.photo_url, profile.photo_url),
      role_title: pickAgentField(scraped.role_title, profile.role_title),
    };
  });
}
