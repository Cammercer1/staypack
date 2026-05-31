import { fetchBrightDataHtml } from "@/lib/brightdata/client";
import {
  type AddressMatchInput,
  parseStreetAddress,
  slugifySuburbSegment,
} from "@/lib/scraping/domain/addressMatch";

function normalizeReaPropertyUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

export function isReaListingUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname === "realestate.com.au" ||
      hostname.endsWith(".realestate.com.au")
    );
  } catch {
    return false;
  }
}

export function normalizeReaListingUrl(url: string) {
  if (!isReaListingUrl(url)) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.pathname.includes("/property-")) {
      return null;
    }
    return normalizeReaPropertyUrl(parsed.toString());
  } catch {
    return null;
  }
}

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
    keywordVariants.add(`${parsed.streetNumber.replace(/\//g, "-")} ${parsed.streetName}`);
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

function extractReaPropertyUrls(html: string) {
  const matches = html.match(
    /https:\/\/www\.realestate\.com\.au\/property-[a-z0-9+\-]+/gi,
  );
  if (!matches?.length) {
    return [];
  }

  return [...new Set(matches.map((url) => normalizeReaPropertyUrl(url)))];
}

function scoreReaUrl(url: string, target: ReturnType<typeof parseStreetAddress>) {
  const slug = url.split("/").pop()?.toLowerCase() ?? "";
  let score = 0;

  if (target.state && slug.includes(target.state.toLowerCase())) {
    score += 1;
  }
  if (target.suburb && slug.includes(target.suburb.replace(/\s+/g, "+"))) {
    score += 2;
  }
  if (target.suburb && slug.includes(slugifySuburbSegment(target.suburb))) {
    score += 2;
  }
  if (target.streetName) {
    for (const token of target.streetName.split(/\s+/)) {
      if (token.length > 2 && slug.includes(token)) {
        score += 1;
      }
    }
  }
  if (target.streetNumber) {
    const compact = target.streetNumber.replace(/\//g, "-").toLowerCase();
    if (slug.includes(compact)) {
      score += 2;
    }
  }

  return score;
}

export async function findReaListingUrl(
  input: AddressMatchInput,
): Promise<string | null> {
  const target = parseStreetAddress(input);
  if (!target.suburb || !target.state || !target.postcode) {
    return null;
  }

  const searchUrls = buildReaSearchUrls(input);
  let bestUrl: string | null = null;
  let bestScore = 0;

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
      const score = scoreReaUrl(propertyUrl, target);
      if (score > bestScore) {
        bestScore = score;
        bestUrl = propertyUrl;
      }
    }

    if (bestScore >= 4) {
      break;
    }
  }

  return bestUrl;
}
