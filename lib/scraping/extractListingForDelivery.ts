import type { ParsedListing } from "@/lib/types";
import {
  fetchDomainListingPage,
  isDomainListingUrl,
  mergeAgencyAgentsOntoListing,
  tryDomainListingFallback,
  tryDomainListingPrimary,
} from "@/lib/scraping/domainFallback";
import { fetchRenderedHtml } from "@/lib/scraping/fetchRenderedHtml";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import { mergeParsedListings, parseListing } from "@/lib/scraping/index";
import {
  assessDeliveryListingReadiness,
  formatDeliveryReadinessFailure,
} from "@/lib/scraping/listingCompleteness";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import {
  isBotCheckpointHtml,
  parseAddressFromListingUrl,
} from "@/lib/scraping/parseAddressFromUrl";
import { isReaListingUrl } from "@/lib/scraping/rea/findReaListingUrl";
import { tryReaImport, hasReaImportConfig } from "@/lib/scraping/reaEnrichment";
import {
  isSpfnListingUrl,
  parseSpfnDetailHtml,
} from "@/lib/scraping/spfn/parseSpfnListing";
import { emptyListing } from "@/lib/scraping/parsers/utils";

export type DeliveryExtractMethod =
  | "static_fetch"
  | "browserless_rendered"
  | "brightdata_rea"
  | "brightdata_unlocker";

export type DeliveryExtractSource = "agency" | "rea" | "domain" | "mixed";

export type ExtractListingForDeliveryResult =
  | {
      ok: true;
      listing: ParsedListing;
      method: DeliveryExtractMethod;
      parserName: string;
      source: DeliveryExtractSource;
      warnings: string[];
    }
  | {
      ok: false;
      reason: string;
      listing: ParsedListing;
      warnings: string[];
    };

function finalizeListing(listing: ParsedListing, warnings: string[]): ParsedListing {
  return {
    ...listing,
    displayPrice: normalizeDisplayPrice(listing.displayPrice),
    warnings: [...new Set([...warnings, ...listing.warnings])],
  };
}

function seedFromAddressHint(
  hint: Partial<ParsedListing> | null,
  warnings: string[],
): ParsedListing {
  if (!hint?.address?.trim()) {
    return emptyListing();
  }

  warnings.push(...(hint.warnings ?? []));
  return mergeParsedListings(emptyListing(), {
    images: [],
    agents: [],
    confidence: hint.confidence ?? "medium",
    warnings: hint.warnings ?? [],
    ...hint,
  });
}

async function resolveUrlAddressHint(
  url: string,
  warnings: string[],
): Promise<Partial<ParsedListing> | null> {
  if (!isSpfnListingUrl(url)) {
    return parseAddressFromListingUrl(url);
  }

  const slugHint = parseAddressFromListingUrl(url);
  if (slugHint?.postcode?.trim()) {
    return slugHint;
  }

  try {
    const html = await fetchStaticHtml(url, 15000);
    const fromPage = parseSpfnDetailHtml(html);
    if (fromPage?.address?.trim()) {
      warnings.push(...(fromPage.warnings ?? []));
      return fromPage;
    }
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `SPFN detail fetch failed: ${error.message}`
        : "SPFN detail fetch failed",
    );
  }

  return slugHint;
}

async function fetchAgencyHtml(url: string, warnings: string[]) {
  const isSpfn = isSpfnListingUrl(url);
  let method: "static_fetch" | "browserless_rendered" = isSpfn
    ? "static_fetch"
    : "browserless_rendered";
  let html = "";

  if (isSpfn) {
    try {
      html = await fetchStaticHtml(url, 20000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Static fetch failed";
      warnings.push(msg);
    }
  } else {
    try {
      const rendered = await fetchRenderedHtml(url);
      if (rendered) {
        html = rendered;
      }
    } catch (error) {
      warnings.push(
        error instanceof Error ? error.message : "Rendered page fetch failed",
      );
    }

    if (!html) {
      method = "static_fetch";
      try {
        html = await fetchStaticHtml(url);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Static fetch failed");
      }
    }
  }

  return { html, method };
}

async function scrapeAgencyListing(
  url: string,
  seed: ParsedListing,
  warnings: string[],
): Promise<{
  listing: ParsedListing;
  method: "static_fetch" | "browserless_rendered";
  parserName: string;
  checkpoint: boolean;
  scraped: boolean;
}> {
  const { html, method } = await fetchAgencyHtml(url, warnings);

  if (!html) {
    return {
      listing: seed,
      method,
      parserName: "url_seed",
      checkpoint: false,
      scraped: false,
    };
  }

  const checkpoint = isBotCheckpointHtml(html);
  const ruleParsed = parseListing(html, url);
  let listing = mergeParsedListings(seed, ruleParsed.listing);

  if (checkpoint && /security checkpoint/i.test(listing.title ?? "")) {
    listing = { ...listing, title: undefined };
  }

  return {
    listing,
    method,
    parserName: ruleParsed.parserName,
    checkpoint,
    scraped: true,
  };
}

async function enrichFromRea(
  url: string,
  listing: ParsedListing,
  addressHint: Partial<ParsedListing> | null,
  agencyListing: ParsedListing,
  warnings: string[],
) {
  if (!hasReaImportConfig()) {
    return { listing, used: false };
  }

  const reaImport = await tryReaImport(url, {
    address: listing.address ?? addressHint?.address,
    suburb: listing.suburb ?? addressHint?.suburb,
    state: listing.state ?? addressHint?.state,
    postcode: listing.postcode ?? addressHint?.postcode,
  });
  warnings.push(...reaImport.warnings);

  if (!reaImport.used) {
    return { listing, used: false };
  }

  const merged = mergeAgencyAgentsOntoListing(
    mergeParsedListings(listing, reaImport.listing),
    agencyListing,
  );

  warnings.push(
    reaImport.provider === "apify"
      ? "Enriched from realestate.com.au (Apify)."
      : "Enriched from realestate.com.au (Bright Data).",
  );
  return { listing: merged, used: true };
}

async function enrichFromDomainPrimary(
  url: string,
  listing: ParsedListing,
  agencyListing: ParsedListing,
  warnings: string[],
) {
  const domainPrimary = await tryDomainListingPrimary(url, listing);
  warnings.push(...domainPrimary.warnings);

  if (!domainPrimary.used) {
    return {
      listing,
      used: false,
      method: null as DeliveryExtractMethod | null,
    };
  }

  const merged = mergeAgencyAgentsOntoListing(
    mergeParsedListings(listing, domainPrimary.listing),
    agencyListing,
  );
  warnings.push("Enriched from Domain.com.au.");

  return {
    listing: merged,
    used: true,
    method: "brightdata_unlocker" as const,
  };
}

async function enrichFromDomainFallback(
  url: string,
  listing: ParsedListing,
  agencyListing: ParsedListing,
  checkpoint: boolean,
  warnings: string[],
) {
  const domainFallback = await tryDomainListingFallback(url, listing, checkpoint);
  warnings.push(...domainFallback.warnings);

  if (!domainFallback.used) {
    return {
      listing,
      used: false,
      method: null as DeliveryExtractMethod | null,
    };
  }

  const merged = mergeAgencyAgentsOntoListing(
    mergeParsedListings(listing, domainFallback.listing),
    agencyListing,
  );
  warnings.push("Enriched from Domain.com.au (fallback).");

  return {
    listing: merged,
    used: true,
    method: "brightdata_unlocker" as const,
  };
}

function successResult({
  listing,
  warnings,
  method,
  parserName,
  source,
}: {
  listing: ParsedListing;
  warnings: string[];
  method: DeliveryExtractMethod;
  parserName: string;
  source: DeliveryExtractSource;
}): ExtractListingForDeliveryResult {
  return {
    ok: true,
    listing: finalizeListing(listing, warnings),
    method,
    parserName,
    source,
    warnings: finalizeListing(listing, warnings).warnings,
  };
}

function failureResult(
  listing: ParsedListing,
  warnings: string[],
  target: "str" | "lease" | "core" = "str",
): ExtractListingForDeliveryResult {
  const readiness = assessDeliveryListingReadiness(listing);
  return {
    ok: false,
    reason: formatDeliveryReadinessFailure(readiness, target),
    listing: finalizeListing(listing, warnings),
    warnings: finalizeListing(listing, warnings).warnings,
  };
}

async function extractDirectDomainUrl(url: string): Promise<ExtractListingForDeliveryResult> {
  const warnings: string[] = [];
  const { listing: domainListing, warnings: domainWarnings, method } =
    await fetchDomainListingPage(url);
  warnings.push(...domainWarnings);

  const listing = finalizeListing(domainListing, warnings);
  const readiness = assessDeliveryListingReadiness(listing);

  if (!readiness.strReady) {
    return {
      ok: false,
      reason: formatDeliveryReadinessFailure(readiness, "str"),
      listing,
      warnings: listing.warnings,
    };
  }

  return successResult({
    listing,
    warnings,
    method,
    parserName: "domain",
    source: "domain",
  });
}

async function extractDirectReaUrl(url: string): Promise<ExtractListingForDeliveryResult> {
  const warnings: string[] = [];
  // URL is already a REA listing page — scrape it directly (Apify), no Google discovery.
  const reaImport = await tryReaImport(url, null);
  warnings.push(...reaImport.warnings);

  if (!reaImport.used) {
    return {
      ok: false,
      reason: "Could not import listing from realestate.com.au.",
      listing: finalizeListing(emptyListing(), warnings),
      warnings: finalizeListing(emptyListing(), warnings).warnings,
    };
  }

  const listing = finalizeListing(reaImport.listing, warnings);
  const readiness = assessDeliveryListingReadiness(listing);

  if (!readiness.strReady) {
    return {
      ok: false,
      reason: formatDeliveryReadinessFailure(readiness, "str"),
      listing,
      warnings: listing.warnings,
    };
  }

  return successResult({
    listing,
    warnings,
    method: "brightdata_rea",
    parserName: reaImport.provider === "apify" ? "rea_apify" : "rea_brightdata",
    source: "rea",
  });
}

async function extractViaAgencyWaterfall(url: string): Promise<ExtractListingForDeliveryResult> {
  const warnings: string[] = [];
  const addressHint = await resolveUrlAddressHint(url, warnings);
  let listing = seedFromAddressHint(addressHint, warnings);
  const agencySnapshot = await scrapeAgencyListing(url, listing, warnings);

  listing = agencySnapshot.listing;
  let method: DeliveryExtractMethod = agencySnapshot.method;
  let parserName = agencySnapshot.parserName;
  let source: DeliveryExtractSource = agencySnapshot.scraped ? "agency" : "mixed";

  let readiness = assessDeliveryListingReadiness(listing);
  if (readiness.strReady) {
    warnings.push("Delivery extract: agency site provided sufficient listing data.");
    return successResult({ listing, warnings, method, parserName, source });
  }

  const agencyListing = listing;
  let usedRea = false;
  let usedDomain = false;

  const rea = await enrichFromRea(url, listing, addressHint, agencyListing, warnings);
  listing = rea.listing;
  usedRea = rea.used;
  if (rea.used) {
    method = "brightdata_rea";
    parserName = "rea_brightdata";
  }

  readiness = assessDeliveryListingReadiness(listing);
  if (readiness.strReady) {
    return successResult({
      listing,
      warnings,
      method,
      parserName,
      source: usedRea ? (agencySnapshot.scraped ? "mixed" : "rea") : source,
    });
  }

  const domainPrimary = await enrichFromDomainPrimary(
    url,
    listing,
    agencyListing,
    warnings,
  );
  listing = domainPrimary.listing;
  if (domainPrimary.used) {
    usedDomain = true;
    method = domainPrimary.method ?? method;
    parserName = "domain_primary";
  }

  readiness = assessDeliveryListingReadiness(listing);
  if (readiness.strReady) {
    return successResult({
      listing,
      warnings,
      method,
      parserName,
      source: usedDomain || usedRea ? "mixed" : source,
    });
  }

  const domainFallback = await enrichFromDomainFallback(
    url,
    listing,
    agencyListing,
    agencySnapshot.checkpoint,
    warnings,
  );
  listing = domainFallback.listing;
  if (domainFallback.used) {
    usedDomain = true;
    method = domainFallback.method ?? method;
    parserName = "domain_fallback";
  }

  readiness = assessDeliveryListingReadiness(listing);
  if (readiness.strReady) {
    return successResult({
      listing,
      warnings,
      method,
      parserName,
      source: "mixed",
    });
  }

  return failureResult(listing, warnings, "str");
}

/**
 * Strict listing extract for managed delivery.
 * Agency site first, then REA, then Domain; fail closed when STR-ready data is missing.
 */
export async function extractListingForDelivery(
  url: string,
): Promise<ExtractListingForDeliveryResult> {
  if (isDomainListingUrl(url)) {
    return extractDirectDomainUrl(url);
  }

  if (isReaListingUrl(url)) {
    return extractDirectReaUrl(url);
  }

  return extractViaAgencyWaterfall(url);
}
