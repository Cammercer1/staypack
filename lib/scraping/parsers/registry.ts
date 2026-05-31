import { parseGenericListing } from "@/lib/scraping/parsers/generic";
import { parseHarcourtsListing } from "@/lib/scraping/parsers/harcourts";
import { parseJsonLdListing } from "@/lib/scraping/parsers/jsonLd";
import { parseDomainListing } from "@/lib/scraping/parsers/domain";
import { parseMcGrathListing } from "@/lib/scraping/parsers/mcgrath";
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
    platform: "Ray White",
    hosts: [/raywhite\.com\.au$/i, /raywhite\.com$/i],
    parse: parseRayWhiteListing,
    rolloutStatus: "in_review",
    notes: "Next.js __NEXT_DATA__ property payload; same template nationally.",
    qaListingUrls: [],
  },
  {
    name: "harcourts",
    platform: "Harcourts",
    hosts: [/harcourts\.net$/i, /harcourts[a-z0-9-]*\.com\.au$/i],
    parse: parseHarcourtsListing,
    rolloutStatus: "in_review",
    notes:
      "Two platforms: harcourts.net (CloudHI, listings-photos.cloudhi.io) and franchise *.com.au (WordPress Stepps, propertyimages.stepps.net). Static fetch only.",
    qaListingUrls: [
      "https://harcourts.net/au/office/adelaide-city/listing/l40847935-21-255-hindley-street-adelaide-sa-5000",
      "https://harcourtsnr.com.au/property/house-nsw-goonellabah-l37978463/",
    ],
  },
  {
    name: "mcgrath",
    platform: "McGrath",
    hosts: [/mcgrath\.com\.au$/i],
    parse: parseMcGrathListing,
    rolloutStatus: "in_review",
    notes:
      "Vercel bot checkpoint blocks HTML fetch; address/suburb/state/postcode parsed from /property/{slug} URL path.",
    qaListingUrls: [
      "https://www.mcgrath.com.au/property/42-suttor-road-moss-vale-nsw-2577-59P7099",
    ],
  },
  {
    name: "domain",
    platform: "Domain",
    hosts: [/domain\.com\.au$/i],
    parse: parseDomainListing,
    rolloutStatus: "in_review",
    notes: "Next.js __NEXT_DATA__ componentProps on listing pages; search via listingsMap.",
    qaListingUrls: [
      "https://www.domain.com.au/4-ayrshire-parade-bowral-nsw-2576-2020787358",
    ],
  },
  // Examples for future parsers:
  // {
  //   name: "domain",
  //   platform: "Domain",
  //   hosts: [/domain\.com\.au$/i],
  //   parse: parseDomainListing,
  //   rolloutStatus: "planned",
  // },
];

/** Ordered checklist when onboarding a new franchise platform (one parser covers all offices). */
export const PLATFORM_ROLLOUT_STEPS = [
  "Collect 3–5 live listing URLs (metro, regional, house, unit) from the same host.",
  "Save rendered HTML / __NEXT_DATA__ and confirm one parser covers all samples.",
  "Verify address, beds/baths, display price, description, and 5+ images per sample.",
  "Import via StayPacks and confirm scrape_jobs.parser_name matches the site parser.",
  "Mark rolloutStatus verified in registry before enabling that agency group.",
] as const;

export function platformForListingUrl(url: string) {
  return resolveSiteParser(url)?.platform ?? null;
}

export function platformForAgencyWebsite(websiteUrl: string | null | undefined) {
  if (!websiteUrl?.trim()) {
    return null;
  }
  return platformForListingUrl(websiteUrl);
}

export function isPlatformVerified(url: string) {
  return resolveSiteParser(url)?.rolloutStatus === "verified";
}

export function scraperRolloutSummary() {
  return SITE_PARSERS.map(({ platform, name, rolloutStatus, hosts, qaListingUrls }) => ({
    platform,
    parser: name,
    rolloutStatus,
    hosts: hosts.map((pattern) => pattern.source),
    qaListingUrls: qaListingUrls ?? [],
  }));
}

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
