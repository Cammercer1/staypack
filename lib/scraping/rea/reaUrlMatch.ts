import {
  type AddressMatchInput,
  parseStreetAddress,
  slugifySuburbSegment,
} from "@/lib/scraping/domain/addressMatch";

export function normalizeReaPropertyUrl(url: string) {
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

/** REA property detail paths: legacy `/property-apartment-qld-…` or `/property/unit-…`. */
export function isReaPropertyPathname(pathname: string) {
  const path = pathname.toLowerCase();
  if (path.includes("/property-")) {
    return true;
  }
  return /^\/property\/[^/]+/.test(path);
}

export function normalizeReaListingUrl(url: string) {
  if (!isReaListingUrl(url)) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (!isReaPropertyPathname(parsed.pathname)) {
      return null;
    }
    return normalizeReaPropertyUrl(parsed.toString());
  } catch {
    return null;
  }
}

const REA_PROPERTY_PATH =
  /https?:\/\/(?:www\.)?realestate\.com\.au\/(?:property-[a-z0-9+\-]+|property\/[a-z0-9+\-]+)/gi;

/** Pull REA property URLs from HTML (page body or Google result markup). */
export function extractReaPropertyUrls(html: string) {
  const urls = new Set<string>();

  for (const match of html.matchAll(REA_PROPERTY_PATH)) {
    const normalized = normalizeReaListingUrl(match[0]);
    if (normalized) urls.add(normalized);
  }

  for (const match of html.matchAll(
    /\/url\?q=(https?%3A%2F%2Fwww\.realestate\.com\.au[^&"'<>]+)/gi,
  )) {
    try {
      const decoded = decodeURIComponent(match[1]);
      const normalized = normalizeReaListingUrl(decoded);
      if (normalized) urls.add(normalized);
    } catch {
      // ignore
    }
  }

  return [...urls];
}

export function scoreReaUrl(
  url: string,
  target: ReturnType<typeof parseStreetAddress>,
) {
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

  score += reaUrlFormatBonus(url);

  return score;
}

/** Prefer `/property-house-qld-suburb-151270520` over `/property/40-harwood-st-…` for Bright Data. */
export type ReaUrlFormat = "property_id" | "address_slug" | "other";

export function reaUrlFormat(url: string): ReaUrlFormat {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/^\/property\/[^/]+$/.test(path)) {
      return "address_slug";
    }

    const segment = path.split("/").filter(Boolean).pop() ?? "";
    if (path.startsWith("/property-") && /-\d{6,}$/.test(segment)) {
      return "property_id";
    }
  } catch {
    // ignore
  }

  return "other";
}

function reaUrlFormatBonus(url: string) {
  switch (reaUrlFormat(url)) {
    case "property_id":
      return 10;
    case "address_slug":
      return 0;
    default:
      return 0;
  }
}

/** Dedupe and sort REA property URLs — best first for dataset scrape. */
export function rankReaUrlCandidates(
  candidates: string[],
  input: AddressMatchInput,
): string[] {
  const target = parseStreetAddress(input);
  const unique = [
    ...new Set(
      candidates
        .map((url) => normalizeReaListingUrl(url))
        .filter((url): url is string => Boolean(url)),
    ),
  ];

  if (!unique.length) {
    return [];
  }

  const scored = unique
    .map((url) => ({ url, score: scoreReaUrl(url, target) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1) {
    return [scored[0]!.url];
  }

  return scored.filter((entry) => entry.score > 0).map((entry) => entry.url);
}

export function pickBestReaUrl(
  candidates: string[],
  input: AddressMatchInput,
): string | null {
  const ranked = rankReaUrlCandidates(candidates, input);
  return ranked[0] ?? null;
}

/** Build a Google query biased to REA property pages at the top of results. */
export function buildGoogleReaSearchQuery(input: AddressMatchInput) {
  const parts: string[] = ["site:realestate.com.au"];

  const street = input.address
    ?.split(",")[0]
    ?.trim()
    .replace(/(\d)\/(\d+)-(\d+)/g, "$1/$2 $3")
    .replace(/-/g, " ");
  if (street) {
    parts.push(street);
  }

  if (input.suburb?.trim()) {
    parts.push(input.suburb.trim());
  }
  if (input.state?.trim()) {
    parts.push(input.state.trim().toUpperCase());
  }
  if (input.postcode?.trim()) {
    parts.push(input.postcode.trim());
  }

  if (parts.length <= 1) {
    return null;
  }

  return parts.join(" ");
}

export function buildGoogleSearchUrl(query: string) {
  const params = new URLSearchParams({
    q: query,
    hl: "en-AU",
    gl: "au",
    num: "10",
  });
  return `https://www.google.com.au/search?${params.toString()}`;
}

export function hasMinimumAddressForReaDiscovery(
  input: AddressMatchInput,
): boolean {
  return Boolean(
    input.address?.trim() ||
      (input.suburb?.trim() && input.state?.trim()),
  );
}
