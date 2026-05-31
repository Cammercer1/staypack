import type { ParsedListing } from "@/lib/types";
import { parseListingFromHtml } from "@/lib/openai/parseListingFromHtml";
import { fetchRenderedHtml } from "@/lib/scraping/fetchRenderedHtml";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import { mergeParsedListings, parseListing } from "@/lib/scraping/index";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import {
  isDomainListingUrl,
  mergeAgencyAgentsOntoListing,
  tryDomainListingFallback,
  tryDomainListingPrimary,
} from "@/lib/scraping/domainFallback";
import { listingHostname, resolveSiteParser } from "@/lib/scraping/parsers/registry";
import {
  isBotCheckpointHtml,
  parseAddressFromListingUrl,
} from "@/lib/scraping/parseAddressFromUrl";

function shouldSkipAiEnrichment(
  url: string,
  listing: ParsedListing,
  parserName: string,
  checkpoint: boolean,
) {
  if (
    checkpoint ||
    parserName === "domain_fallback" ||
    parserName === "domain_primary"
  ) {
    return true;
  }

  const hostname = listingHostname(url);
  const siteParser = resolveSiteParser(url);
  if (
    siteParser?.name === "domain" &&
    hostname?.endsWith("domain.com.au") &&
    listing.confidence === "high"
  ) {
    return true;
  }

  return false;
}

function emptyListing(): ParsedListing {
  return {
    images: [],
    agents: [],
    confidence: "low",
    warnings: [],
  };
}

function finalizeListing(
  listing: ParsedListing,
  warnings: string[],
): ParsedListing {
  const mergedWarnings = [...new Set([...warnings, ...listing.warnings])];

  const finalized = {
    ...listing,
    displayPrice: normalizeDisplayPrice(listing.displayPrice),
    warnings: mergedWarnings,
  };

  if (
    !finalized.title &&
    !finalized.description &&
    finalized.images.length === 0
  ) {
    finalized.warnings.push(
      "Limited listing data extracted. Please review manually.",
    );
  }

  return finalized;
}

/** Domain.com.au embeds listing data in __NEXT_DATA__; static fetch is enough and avoids Browserless timeouts. */
async function fetchDomainListingHtml(url: string, warnings: string[]) {
  // #region agent log
  const domainFetchStartedAt = Date.now();
  // #endregion

  try {
    const html = await fetchStaticHtml(url);
    // #region agent log
    fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'post-fix',hypothesisId:'H1',location:'extractListing.ts:fetchDomainListingHtml',message:'domain static fetch complete',data:{url,hasHtml:Boolean(html),staticMs:Date.now()-domainFetchStartedAt},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return { html, method: "static_fetch" as const };
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Static fetch failed");
    return { html: "", method: "static_fetch" as const };
  }
}

async function fetchAgencyHtml(url: string, warnings: string[]) {
  if (isDomainListingUrl(url)) {
    return fetchDomainListingHtml(url, warnings);
  }

  let method: "static_fetch" | "browserless_rendered" = "browserless_rendered";
  let html = "";
  // #region agent log
  const agencyFetchStartedAt = Date.now();
  // #endregion

  try {
    const browserlessStartedAt = Date.now();
    const rendered = await fetchRenderedHtml(url);
    // #region agent log
    fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H1',location:'extractListing.ts:fetchAgencyHtml:browserless',message:'browserless attempt finished',data:{url,hasHtml:Boolean(rendered),browserlessMs:Date.now()-browserlessStartedAt},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
      const staticStartedAt = Date.now();
      html = await fetchStaticHtml(url);
      // #region agent log
      fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H4',location:'extractListing.ts:fetchAgencyHtml:static',message:'static fetch finished',data:{url,hasHtml:Boolean(html),staticMs:Date.now()-staticStartedAt},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (warnings.length) {
        warnings.push(
          "Full page import was unavailable. Used a basic fetch of this page instead.",
        );
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Static fetch failed");
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H1',location:'extractListing.ts:fetchAgencyHtml:done',message:'fetchAgencyHtml complete',data:{url,method,hasHtml:Boolean(html),totalMs:Date.now()-agencyFetchStartedAt},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return { html, method };
}

function listingFromUrlAddress(url: string, warnings: string[]) {
  const urlAddress = parseAddressFromListingUrl(url);
  if (!urlAddress?.address?.trim()) {
    return null;
  }

  const listing = mergeParsedListings(emptyListing(), {
    images: [],
    agents: [],
    confidence: urlAddress.confidence ?? "medium",
    warnings: urlAddress.warnings ?? [],
    ...urlAddress,
  });

  warnings.push(...(urlAddress.warnings ?? []));
  return listing;
}

async function enrichFromAgencySite(
  url: string,
  listing: ParsedListing,
  warnings: string[],
  options?: { agentsOnly?: boolean },
) {
  const { html, method } = await fetchAgencyHtml(url, warnings);
  if (!html) {
    return { listing, method, parserName: null as string | null, checkpoint: false };
  }

  const checkpoint = isBotCheckpointHtml(html);
  const ruleParsed = parseListing(html, url);
  let parserName = ruleParsed.parserName;
  let merged = ruleParsed.listing;

  if (checkpoint && /security checkpoint/i.test(merged.title ?? "")) {
    merged = { ...merged, title: undefined };
  }

  const urlAddress = parseAddressFromListingUrl(url);
  if (!merged.address?.trim() && urlAddress?.address) {
    merged = mergeParsedListings(merged, {
      images: [],
      agents: [],
      confidence: urlAddress.confidence ?? "medium",
      warnings: urlAddress.warnings ?? [],
      ...urlAddress,
    });
    warnings.push(...(urlAddress.warnings ?? []));
  }

  if (options?.agentsOnly) {
    return {
      listing: mergeAgencyAgentsOntoListing(listing, merged),
      method,
      parserName,
      checkpoint,
    };
  }

  return {
    listing: mergeParsedListings(listing, merged),
    method,
    parserName,
    checkpoint,
  };
}

export type ExtractListingResult = {
  listing: ParsedListing;
  method: "static_fetch" | "browserless_rendered";
  parserName: string;
  warnings: string[];
};

export async function extractListingFromUrl(url: string): Promise<ExtractListingResult> {
  const warnings: string[] = [];
  // #region agent log
  const extractStartedAt = Date.now();
  fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H1',location:'extractListing.ts:extractListingFromUrl:start',message:'extract started',data:{url,isDomain:isDomainListingUrl(url)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (isDomainListingUrl(url)) {
    const fetchStartedAt = Date.now();
    const { html, method } = await fetchAgencyHtml(url, warnings);
    // #region agent log
    fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H1',location:'extractListing.ts:domain:fetchAgencyHtml',message:'domain fetch complete',data:{method,htmlLength:html?.length??0,fetchMs:Date.now()-fetchStartedAt},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!html) {
      throw new Error(
        "Unable to fetch listing HTML. Check the URL and try again, or enter details manually.",
      );
    }

    const checkpoint = isBotCheckpointHtml(html);
    let ruleParsed = parseListing(html, url);
    let parserName = ruleParsed.parserName;
    let listing = ruleParsed.listing;

    if (checkpoint && /security checkpoint/i.test(listing.title ?? "")) {
      listing = { ...listing, title: undefined };
    }

    const skipAi = shouldSkipAiEnrichment(url, listing, parserName, checkpoint);
    // #region agent log
    fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H3',location:'extractListing.ts:domain:parse',message:'domain parse complete',data:{parserName,skipAi,confidence:listing.confidence,checkpoint,imageCount:listing.images.length,hasDescription:Boolean(listing.description?.trim())},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (!skipAi) {
      try {
        const aiListing = await parseListingFromHtml({
          html,
          url,
          fallback: ruleParsed.listing,
        });
        listing = mergeParsedListings(listing, aiListing);
        parserName = "openai";
        warnings.push(...aiListing.warnings);
      } catch (error) {
        warnings.push(
          error instanceof Error ? error.message : "AI listing parse failed",
        );
        listing.warnings.push(
          "Automatic extraction failed. Review the prefilled fields carefully.",
        );
      }
    } else if (skipAi) {
      warnings.push("Skipped AI enrichment because the Domain listing data was complete.");
    }

    // #region agent log
    fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H1',location:'extractListing.ts:domain:done',message:'domain extract complete',data:{totalMs:Date.now()-extractStartedAt},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return {
      listing: finalizeListing(listing, warnings),
      method,
      parserName,
      warnings: finalizeListing(listing, warnings).warnings,
    };
  }

  let method: ExtractListingResult["method"] = "static_fetch";
  let parserName = resolveSiteParser(url)?.name ?? "generic";
  let domainPrimaryAttempted = false;

  const urlSeed = listingFromUrlAddress(url, warnings);
  let listing = urlSeed ?? emptyListing();

  if (urlSeed) {
    domainPrimaryAttempted = true;
    const domainPrimary = await tryDomainListingPrimary(url, listing);
    listing = domainPrimary.listing;
    warnings.push(...domainPrimary.warnings);

    if (domainPrimary.used) {
      const agency = await enrichFromAgencySite(url, listing, warnings, {
        agentsOnly: true,
      });
      method = agency.method;
      listing = agency.listing;
      if (agency.parserName) {
        parserName = "domain_primary";
      }

      warnings.push(
        "Used Domain.com.au for property details. Agency site was checked for listing agents.",
      );

      return {
        listing: finalizeListing(listing, warnings),
        method,
        parserName: "domain_primary",
        warnings: finalizeListing(listing, warnings).warnings,
      };
    }
  }

  const { html, method: fetchMethod } = await fetchAgencyHtml(url, warnings);
  method = fetchMethod;

  if (!html) {
    if (!urlSeed) {
      throw new Error(
        "Unable to fetch listing HTML. Check the URL and try again, or enter details manually.",
      );
    }

    if (!domainPrimaryAttempted) {
      const domainPrimary = await tryDomainListingPrimary(url, listing);
      listing = domainPrimary.listing;
      warnings.push(...domainPrimary.warnings);
      if (domainPrimary.used) {
        parserName = "domain_primary";
      }
    }

    warnings.push(
      "Could not fetch the agency listing page. Used the address from the URL and searched Domain.com.au.",
    );

    return {
      listing: finalizeListing(listing, warnings),
      method,
      parserName,
      warnings: finalizeListing(listing, warnings).warnings,
    };
  }

  const checkpoint = isBotCheckpointHtml(html);
  let ruleParsed = parseListing(html, url);
  parserName = ruleParsed.parserName;
  listing = mergeParsedListings(listing, ruleParsed.listing);

  if (checkpoint && /security checkpoint/i.test(listing.title ?? "")) {
    listing = { ...listing, title: undefined };
  }

  const urlAddress = parseAddressFromListingUrl(url);
  if (!listing.address?.trim() && urlAddress?.address) {
    listing = mergeParsedListings(listing, {
      images: [],
      agents: [],
      confidence: urlAddress.confidence ?? "medium",
      warnings: urlAddress.warnings ?? [],
      ...urlAddress,
    });
    warnings.push(...(urlAddress.warnings ?? []));
  }

  if (!domainPrimaryAttempted) {
    const domainPrimary = await tryDomainListingPrimary(url, listing);
    listing = domainPrimary.listing;
    warnings.push(...domainPrimary.warnings);
    domainPrimaryAttempted = true;

    if (domainPrimary.used) {
      listing = mergeAgencyAgentsOntoListing(listing, ruleParsed.listing);
      parserName = "domain_primary";
      warnings.push(
        "Used Domain.com.au for property details. Agency site was checked for listing agents.",
      );

      return {
        listing: finalizeListing(listing, warnings),
        method,
        parserName,
        warnings: finalizeListing(listing, warnings).warnings,
      };
    }
  }

  const domainFallback = await tryDomainListingFallback(url, listing, checkpoint);
  listing = domainFallback.listing;
  warnings.push(...domainFallback.warnings);

  if (domainFallback.used) {
    parserName = "domain_fallback";
  }

  const skipAi = shouldSkipAiEnrichment(url, listing, parserName, checkpoint);

  if (!domainFallback.used && parserName !== "domain_primary" && !skipAi) {
    try {
      const aiListing = await parseListingFromHtml({
        html,
        url,
        fallback: ruleParsed.listing,
      });
      listing = mergeParsedListings(listing, aiListing);
      parserName = "openai";
      warnings.push(...aiListing.warnings);
    } catch (error) {
      warnings.push(
        error instanceof Error ? error.message : "AI listing parse failed",
      );
      listing.warnings.push(
        "Automatic extraction failed. Review the prefilled fields carefully.",
      );
    }
  } else if (skipAi && parserName !== "domain_primary" && !domainFallback.used) {
    const reason = checkpoint
      ? "agency site returned a bot checkpoint page"
      : parserName === "domain"
        ? "Domain listing data was complete"
        : "listing data was already sufficient";
    warnings.push(`Skipped AI enrichment because the ${reason}.`);
  }

  return {
    listing: finalizeListing(listing, warnings),
    method,
    parserName,
    warnings: finalizeListing(listing, warnings).warnings,
  };
}
