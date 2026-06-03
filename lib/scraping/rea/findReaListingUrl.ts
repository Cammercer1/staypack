import type { AddressMatchInput } from "@/lib/scraping/domain/addressMatch";
import { findReaListingUrlCandidates } from "@/lib/scraping/rea/findReaListingUrlCandidates";

export {
  isReaListingUrl,
  normalizeReaListingUrl,
} from "@/lib/scraping/rea/reaUrlMatch";

export { findReaListingUrlCandidates } from "@/lib/scraping/rea/findReaListingUrlCandidates";

/**
 * Resolve a REA property URL for an address.
 * 1. Google SERP (site:realestate.com.au) — works without postcode
 * 2. REA on-site search — fallback when postcode is known
 */
export async function findReaListingUrl(
  input: AddressMatchInput,
): Promise<string | null> {
  const candidates = await findReaListingUrlCandidates(input);
  return candidates[0] ?? null;
}
