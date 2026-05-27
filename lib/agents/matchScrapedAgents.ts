import type { AgentProfile, ParsedListing } from "@/lib/types";

export type ScrapedAgentCandidate = ParsedListing["agents"][number] & {
  name: string;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isUsablePhotoUrl(value?: string | null) {
  if (!value?.trim()) {
    return false;
  }

  return !/^data:image\/svg/i.test(value.trim());
}

export function scrapedAgentCandidates(
  agents: ParsedListing["agents"] | undefined,
): ScrapedAgentCandidate[] {
  return (agents ?? [])
    .filter((agent): agent is ScrapedAgentCandidate => Boolean(agent.name?.trim()))
    .map((agent) => ({
      ...agent,
      name: agent.name.trim(),
      photo_url: isUsablePhotoUrl(agent.photo_url) ? agent.photo_url : undefined,
    }));
}

export function agentProfileMatchesScraped(
  profile: AgentProfile,
  scraped: ScrapedAgentCandidate,
) {
  const profileEmail = profile.email?.trim();
  const scrapedEmail = scraped.email?.trim();
  if (profileEmail && scrapedEmail) {
    return normalizeEmail(profileEmail) === normalizeEmail(scrapedEmail);
  }

  const profilePhone = profile.phone?.trim();
  const scrapedPhone = scraped.phone?.trim();
  if (profilePhone && scrapedPhone) {
    const left = normalizePhone(profilePhone);
    const right = normalizePhone(scrapedPhone);
    if (left.length >= 8 && right.length >= 8 && left === right) {
      return true;
    }
  }

  return normalizeName(profile.name) === normalizeName(scraped.name);
}

export function findUnknownScrapedAgents(
  scrapedAgents: ParsedListing["agents"] | undefined,
  agencyAgents: AgentProfile[],
) {
  const candidates = scrapedAgentCandidates(scrapedAgents);
  const seen = new Set<string>();

  return candidates.filter((scraped) => {
    const key = [
      normalizeName(scraped.name),
      scraped.email ? normalizeEmail(scraped.email) : "",
      scraped.phone ? normalizePhone(scraped.phone) : "",
    ].join("|");

    if (seen.has(key)) {
      return false;
    }
    seen.add(key);

    return !agencyAgents.some((profile) =>
      agentProfileMatchesScraped(profile, scraped),
    );
  });
}
