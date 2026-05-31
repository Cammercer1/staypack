import type { ParsedListing } from "@/lib/types";
import { mergeListingAgents } from "@/lib/agents/agentContact";
import {
  fetchBrowserlessContentHtml,
  fetchBrowserlessUnblockHtml,
  hasBrowserlessConfig,
} from "@/lib/browserless/client";
import { listingHostname } from "@/lib/scraping/parsers/registry";
import { findDomainListingUrl } from "@/lib/scraping/domain/findDomainListingUrl";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import { mergeParsedListings } from "@/lib/scraping/index";
import {
  domainHtmlHasListingPayload,
  parseDomainListing,
} from "@/lib/scraping/parsers/domain";
import { emptyListing } from "@/lib/scraping/parsers/utils";

const DOMAIN_STATIC_TIMEOUT_MS = 8_000;
const DOMAIN_BROWSERLESS_TIMEOUT_MS = 22_000;

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

function parseDomainHtml(domainUrl: string, html: string) {
  const listing = parseDomainListing(html, domainUrl);
  const hasPayload = domainHtmlHasListingPayload(html);
  return { listing, hasPayload };
}

async function fetchDomainHtmlViaBrowser(domainUrl: string, warnings: string[]) {
  if (!hasBrowserlessConfig()) {
    return null;
  }

  try {
    const html = await fetchBrowserlessContentHtml(domainUrl, {
      timeoutMs: DOMAIN_BROWSERLESS_TIMEOUT_MS,
    });
    if (html && domainHtmlHasListingPayload(html)) {
      return html;
    }
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Browser fetch failed: ${error.message}`
        : "Browser fetch failed",
    );
  }

  try {
    warnings.push("Trying stealth browser fetch for Domain.");
    const html = await fetchBrowserlessUnblockHtml(domainUrl, {
      timeoutMs: DOMAIN_BROWSERLESS_TIMEOUT_MS,
    });
    if (html && domainHtmlHasListingPayload(html)) {
      return html;
    }
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Stealth browser fetch failed: ${error.message}`
        : "Stealth browser fetch failed",
    );
  }

  return null;
}

/**
 * Domain listing import. Local dev uses static fetch (residential IP).
 * Production uses Browserless (real Chrome) because Netlify datacenter IPs are blocked.
 */
export async function fetchDomainListingPage(domainUrl: string) {
  const warnings: string[] = [];
  let html = "";
  let method: "static_fetch" | "browserless_rendered" = "static_fetch";

  const useBrowserInProd =
    process.env.NODE_ENV === "production" && hasBrowserlessConfig();

  if (useBrowserInProd) {
    warnings.push("Fetching Domain listing via browser (production).");
    html = (await fetchDomainHtmlViaBrowser(domainUrl, warnings)) ?? "";
    if (html) {
      method = "browserless_rendered";
    }
  } else {
    try {
      html = await fetchStaticHtml(domainUrl, DOMAIN_STATIC_TIMEOUT_MS);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Could not fetch Domain listing: ${error.message}`
          : "Could not fetch Domain listing",
      );
    }

    const staticParsed = html ? parseDomainHtml(domainUrl, html) : null;
    if (!staticParsed?.hasPayload && hasBrowserlessConfig()) {
      warnings.push("Static fetch did not include Domain listing data. Trying browser.");
      const rendered = await fetchDomainHtmlViaBrowser(domainUrl, warnings);
      if (rendered) {
        html = rendered;
        method = "browserless_rendered";
      }
    }
  }

  if (!html) {
    return { html: "", listing: emptyListing(), warnings, method };
  }

  const { listing } = parseDomainHtml(domainUrl, html);
  if (!listing.address?.trim()) {
    warnings.push("Domain listing page did not return usable listing data.");
  }

  // #region agent log
  fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'post-fix',hypothesisId:'H9',location:'domainFallback.ts:fetchDomainListingPage',message:'domain page fetched',data:{domainUrl,method,useBrowserInProd,imageCount:listing.images.length,hasAddress:Boolean(listing.address?.trim()),hasPayload:domainHtmlHasListingPayload(html)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return { html, listing, warnings, method };
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
