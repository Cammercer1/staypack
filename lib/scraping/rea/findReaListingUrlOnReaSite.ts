import { fetchBrightDataHtml } from "@/lib/brightdata/client";
import type { AddressMatchInput } from "@/lib/scraping/domain/addressMatch";
import {
  parseStreetAddress,
  slugifySuburbSegment,
} from "@/lib/scraping/domain/addressMatch";
import { extractReaPropertyUrls, rankReaUrlCandidates, scoreReaUrl } from "@/lib/scraping/rea/reaUrlMatch";

function buildReaSearchUrls(input: AddressMatchInput) {
  const parsed = parseStreetAddress(input);
  if (!parsed.suburb || !parsed.state || !parsed.postcode) {
    return [];
  }

  const suburbSlug = slugifySuburbSegment(parsed.suburb);
  const state = parsed.state.toLowerCase();
  const postcode = parsed.postcode;
  const channels = ["buy", "rent"] as const;
  const urls = new Set<string>();

  const streetLine = input.address?.split(",")[0]?.trim();
  const keywordVariants = new Set<string>();
  if (streetLine) {
    keywordVariants.add(streetLine);
    keywordVariants.add(streetLine.replace(/\//g, "-"));
  }
  if (parsed.streetNumber && parsed.streetName) {
    keywordVariants.add(`${parsed.streetNumber} ${parsed.streetName}`);
    keywordVariants.add(
      `${parsed.streetNumber.replace(/\//g, "-")} ${parsed.streetName}`,
    );
  }

  for (const channel of channels) {
    const base = `https://www.realestate.com.au/${channel}/in-${suburbSlug}-${state}-${postcode}/list-1`;
    urls.add(base);
    for (const keywords of keywordVariants) {
      urls.add(`${base}?keywords=${encodeURIComponent(keywords)}`);
    }
  }

  return [...urls];
}

/** REA on-site search (unlocker HTML). Needs suburb, state, and postcode. */
export async function findReaListingUrlCandidatesOnReaSite(
  input: AddressMatchInput,
): Promise<string[]> {
  const target = parseStreetAddress(input);
  if (!target.suburb || !target.state || !target.postcode) {
    return [];
  }

  const searchUrls = buildReaSearchUrls(input);
  const candidates: string[] = [];

  for (const searchUrl of searchUrls) {
    let html = "";
    try {
      html = (await fetchBrightDataHtml(searchUrl)) ?? "";
    } catch {
      continue;
    }

    if (!html) {
      continue;
    }

    for (const propertyUrl of extractReaPropertyUrls(html)) {
      if (scoreReaUrl(propertyUrl, target) > 0 && !candidates.includes(propertyUrl)) {
        candidates.push(propertyUrl);
      }
    }

    const ranked = rankReaUrlCandidates(candidates, input);
    if (ranked[0] && scoreReaUrl(ranked[0], target) >= 6) {
      break;
    }
  }

  return rankReaUrlCandidates(candidates, input);
}

export async function findReaListingUrlOnReaSite(
  input: AddressMatchInput,
): Promise<string | null> {
  const ranked = await findReaListingUrlCandidatesOnReaSite(input);
  return ranked[0] ?? null;
}
