import type { ParsedListing } from "@/lib/types";
import { listingHostname } from "@/lib/scraping/parsers/registry";
import { findDomainListingUrl } from "@/lib/scraping/domain/findDomainListingUrl";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import { mergeParsedListings } from "@/lib/scraping/index";
import { parseDomainListing } from "@/lib/scraping/parsers/domain";

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
  const hostname = listingHostname(sourceUrl);
  if (!hostname || hostname.endsWith("domain.com.au")) {
    return false;
  }

  return listingNeedsDomainFallback(listing, checkpoint);
}

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
  const warnings: string[] = [];

  if (!shouldTryDomainFallback(sourceUrl, listing, checkpoint)) {
    return { listing, used: false, warnings };
  }

  const domainUrl = await findDomainListingUrl({
    address: listing.address,
    suburb: listing.suburb,
    state: listing.state,
    postcode: listing.postcode,
  });

  if (!domainUrl) {
    warnings.push(
      "Could not find a matching listing on Domain.com.au for this address. Import used limited data from the original URL.",
    );
    return { listing, used: false, warnings };
  }

  let html = "";
  try {
    html = await fetchStaticHtml(domainUrl);
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Found Domain listing but could not fetch it: ${error.message}`
        : "Found Domain listing but could not fetch it",
    );
    return { listing, used: false, domainUrl, warnings };
  }

  const domainParsed = parseDomainListing(html, domainUrl);
  if (!domainParsed.address?.trim()) {
    warnings.push("Domain fallback page did not return usable listing data.");
    return { listing, used: false, domainUrl, warnings };
  }

  const merged = mergeParsedListings(listing, domainParsed);
  warnings.push(
    `Primary site was blocked or incomplete. Enriched from Domain: ${domainUrl}`,
  );

  return {
    listing: {
      ...merged,
      warnings: [...new Set([...merged.warnings, ...warnings, ...domainParsed.warnings])],
    },
    used: true,
    domainUrl,
    warnings,
  };
}
