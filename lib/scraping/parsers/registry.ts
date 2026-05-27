import { parseGenericListing } from "@/lib/scraping/parsers/generic";
import { parseJsonLdListing } from "@/lib/scraping/parsers/jsonLd";
import { parseOpenGraphListing } from "@/lib/scraping/parsers/openGraph";
import { parseRayWhiteListing } from "@/lib/scraping/parsers/rayWhite";
import type { ListingParser, SiteListingParser } from "@/lib/scraping/parsers/types";

/**
 * Site-specific parsers for portals where we know the HTML/JSON shape.
 * Add a file under parsers/, register the host here, and implement parse().
 */
export const SITE_PARSERS: SiteListingParser[] = [
  {
    name: "ray_white",
    hosts: [/raywhite\.com\.au$/i, /raywhite\.com$/i],
    parse: parseRayWhiteListing,
  },
  // Examples for future parsers:
  // { name: "domain", hosts: [/domain\.com\.au$/i], parse: parseDomainListing },
  // { name: "realestate_com_au", hosts: [/realestate\.com\.au$/i], parse: parseRealestateComAuListing },
];

/** Run on every listing to fill gaps (structured data, meta tags, heuristics). */
export const UNIVERSAL_PARSERS: ListingParser[] = [
  { name: "json_ld", parse: parseJsonLdListing },
  { name: "open_graph", parse: parseOpenGraphListing },
  { name: "generic", parse: parseGenericListing },
];

export function listingHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function hostMatches(hostname: string, pattern: RegExp) {
  return pattern.test(hostname);
}

export function resolveSiteParser(url: string): SiteListingParser | null {
  const hostname = listingHostname(url);
  if (!hostname) {
    return null;
  }

  return (
    SITE_PARSERS.find((parser) =>
      parser.hosts.some((pattern) => hostMatches(hostname, pattern)),
    ) ?? null
  );
}

export function parsersForUrl(url: string): ListingParser[] {
  const site = resolveSiteParser(url);
  return site ? [site, ...UNIVERSAL_PARSERS] : UNIVERSAL_PARSERS;
}
