import { fetchBrightDataHtml } from "@/lib/brightdata/client";
import type { AddressMatchInput } from "@/lib/scraping/domain/addressMatch";
import {
  buildGoogleReaSearchQuery,
  buildGoogleSearchUrl,
  extractReaPropertyUrls,
  hasMinimumAddressForReaDiscovery,
  rankReaUrlCandidates,
} from "@/lib/scraping/rea/reaUrlMatch";

/**
 * Resolve REA listing URLs via Google SERP (site:realestate.com.au + address).
 * Requires Bright Data Web Unlocker — same zone as REA/Domain HTML fetch.
 */
export async function findReaListingUrlCandidatesViaGoogle(
  input: AddressMatchInput,
): Promise<string[]> {
  if (!hasMinimumAddressForReaDiscovery(input)) {
    return [];
  }

  const query = buildGoogleReaSearchQuery(input);
  if (!query) {
    return [];
  }

  const searchUrl = buildGoogleSearchUrl(query);
  const html = await fetchBrightDataHtml(searchUrl);
  if (!html) {
    return [];
  }

  const candidates = extractReaPropertyUrls(html);
  return rankReaUrlCandidates(candidates, input);
}

export async function findReaListingUrlViaGoogle(
  input: AddressMatchInput,
): Promise<string | null> {
  const ranked = await findReaListingUrlCandidatesViaGoogle(input);
  return ranked[0] ?? null;
}
