import type { ParsedListing } from "@/lib/types";
import { mergeListingAgents } from "@/lib/agents/agentContact";
import { listingHostname } from "@/lib/scraping/parsers/registry";
import { findDomainListingUrl } from "@/lib/scraping/domain/findDomainListingUrl";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import { mergeParsedListings } from "@/lib/scraping/index";
import { parseDomainListing } from "@/lib/scraping/parsers/domain";
import { emptyListing } from "@/lib/scraping/parsers/utils";

export function isDomainListingUrl(sourceUrl: string) {
  const hostname = listingHostname(sourceUrl);
  return Boolean(hostname?.endsWith("domain.com.au"));
}

export function hasSearchableDomainAddress(listing: ParsedListing) {
  return Boolean(
    listing.address?.trim() &&
      listing.suburb?.trim() &&
      listing.state?.trim() &&
      listing.postcode?.trim(),
  );
}

function listingNeedsDomainFallback(listing: ParsedListing, checkpoint: boolean) {
  if (checkpoint) {
    return true;
  }

  const hasRichDescription =
    (listing.description?.trim().length ?? 0) > 200 &&
    !/domain\.com\.au/i.test(listing.description ?? "");
  const hasImages = listing.images.length >= 3;

  return Boolean(listing.address?.trim()) && (!hasRichDescription || !hasImages);
}

export function shouldTryDomainFallback(
  sourceUrl: string,
  listing: ParsedListing,
  checkpoint: boolean,
) {
  if (isDomainListingUrl(sourceUrl)) {
    return false;
  }

  return listingNeedsDomainFallback(listing, checkpoint);
}

export function shouldTryDomainPrimary(sourceUrl: string, listing: ParsedListing) {
  if (isDomainListingUrl(sourceUrl)) {
    return false;
  }

  return hasSearchableDomainAddress(listing);
}

/** Same static fetch + __NEXT_DATA__ parse used by McGrath→Domain enrichment. */
export async function fetchDomainListingPage(domainUrl: string) {
  const warnings: string[] = [];
  let html = "";

  try {
    html = await fetchStaticHtml(domainUrl);
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Could not fetch Domain listing: ${error.message}`
        : "Could not fetch Domain listing",
    );
    return { html: "", listing: emptyListing(), warnings };
  }

  const listing = parseDomainListing(html, domainUrl);
  if (!listing.address?.trim()) {
    warnings.push("Domain listing page did not return usable listing data.");
  }

  return { html, listing, warnings };
}

async function fetchAndParseDomainListing(
  sourceUrl: string,
  listing: ParsedListing,
  successMessage: string,
  notFoundMessage: string,
): Promise<{
  listing: ParsedListing;
  used: boolean;
  domainUrl?: string;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const domainUrl = await findDomainListingUrl({
    address: listing.address,
    suburb: listing.suburb,
    state: listing.state,
    postcode: listing.postcode,
  });

  if (!domainUrl) {
    warnings.push(notFoundMessage);
    return { listing, used: false, warnings };
  }

  const fetched = await fetchDomainListingPage(domainUrl);
  warnings.push(...fetched.warnings);

  if (!fetched.listing.address?.trim()) {
    return { listing, used: false, domainUrl, warnings };
  }

  const merged = mergeParsedListings(listing, fetched.listing);
  warnings.push(`${successMessage}: ${domainUrl}`);

  return {
    listing: {
      ...merged,
      warnings: [
        ...new Set([...merged.warnings, ...warnings, ...fetched.listing.warnings]),
      ],
    },
    used: true,
    domainUrl,
    warnings,
  };
}

/** Domain-first: try before fetching the agency site when we already know the address. */
export async function tryDomainListingPrimary(
  sourceUrl: string,
  listing: ParsedListing,
): Promise<{
  listing: ParsedListing;
  used: boolean;
  domainUrl?: string;
  warnings: string[];
}> {
  if (!shouldTryDomainPrimary(sourceUrl, listing)) {
    return { listing, used: false, warnings: [] };
  }

  return fetchAndParseDomainListing(
    sourceUrl,
    listing,
    "Imported from Domain.com.au",
    "No matching listing found on Domain.com.au yet. Trying the agency website next.",
  );
}

/** After agency parse: enrich when the primary site was blocked or returned thin data. */
export async function tryDomainListingFallback(
  sourceUrl: string,
  listing: ParsedListing,
  checkpoint: boolean,
): Promise<{
  listing: ParsedListing;
  used: boolean;
  domainUrl?: string;
  warnings: string[];
}> {
  if (!shouldTryDomainFallback(sourceUrl, listing, checkpoint)) {
    return { listing, used: false, warnings: [] };
  }

  return fetchAndParseDomainListing(
    sourceUrl,
    listing,
    "Primary site was blocked or incomplete. Enriched from Domain",
    "Could not find a matching listing on Domain.com.au for this address. Import used limited data from the original URL.",
  );
}

export function mergeAgencyAgentsOntoListing(
  listing: ParsedListing,
  agencyListing: ParsedListing,
) {
  if (!agencyListing.agents.length) {
    return listing;
  }

  return {
    ...listing,
    agents: mergeListingAgents(listing.agents, agencyListing.agents),
  };
}
