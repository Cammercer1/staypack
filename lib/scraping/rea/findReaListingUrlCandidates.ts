import type { AddressMatchInput } from "@/lib/scraping/domain/addressMatch";
import { hasBrightDataUnlockerConfig } from "@/lib/brightdata/client";
import { findReaListingUrlCandidatesOnReaSite } from "@/lib/scraping/rea/findReaListingUrlOnReaSite";
import { findReaListingUrlCandidatesViaGoogle } from "@/lib/scraping/rea/findReaListingUrlViaGoogle";
import {
  hasMinimumAddressForReaDiscovery,
  normalizeReaListingUrl,
  rankReaUrlCandidates,
} from "@/lib/scraping/rea/reaUrlMatch";

/**
 * Resolve REA listing URLs to try with the Bright Data dataset, best first.
 * 1. Google SERP (`site:realestate.com.au` + address)
 * 2. REA on-site search (suburb + postcode)
 */
export async function findReaListingUrlCandidates(
  input: AddressMatchInput,
): Promise<string[]> {
  if (!hasBrightDataUnlockerConfig() || !hasMinimumAddressForReaDiscovery(input)) {
    return [];
  }

  const merged: string[] = [];

  const viaGoogle = await findReaListingUrlCandidatesViaGoogle(input);
  merged.push(...viaGoogle);

  const viaReaSite = await findReaListingUrlCandidatesOnReaSite(input);
  for (const url of viaReaSite) {
    if (!merged.includes(url)) {
      merged.push(url);
    }
  }

  return rankReaUrlCandidates(merged, input);
}

export function prependDirectReaUrl(
  candidates: string[],
  directUrl: string | null,
): string[] {
  if (!directUrl) {
    return candidates;
  }

  const normalized = normalizeReaListingUrl(directUrl);
  if (!normalized) {
    return candidates;
  }

  return [normalized, ...candidates.filter((url) => url !== normalized)];
}
