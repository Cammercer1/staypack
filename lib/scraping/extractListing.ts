import type { ParsedListing } from "@/lib/types";
import { hasBrightDataUnlockerConfig } from "@/lib/brightdata/client";
import { parseListingFromHtml } from "@/lib/openai/parseListingFromHtml";
import { fetchRenderedHtml } from "@/lib/scraping/fetchRenderedHtml";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import { mergeParsedListings, parseListing } from "@/lib/scraping/index";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import {
  fetchDomainListingPage,
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
import {
  isSpfnListingUrl,
  parseSpfnDetailHtml,
} from "@/lib/scraping/spfn/parseSpfnListing";
import { isReaListingUrl } from "@/lib/scraping/rea/findReaListingUrl";
import {
  hasReaImportConfig,
  tryReaImport,
  type ReaImportProvider,
} from "@/lib/scraping/reaEnrichment";
import { enrichListingRentalAppraisal } from "@/lib/rental/enrichListingRentalAppraisal";

function shouldSkipAiEnrichment(
  url: string,
  listing: ParsedListing,
  parserName: string,
  checkpoint: boolean,
) {
  if (
    checkpoint ||
    parserName === "domain_fallback" ||
    parserName === "domain_primary" ||
    parserName === "domain_url" ||
    parserName === "rea_brightdata" ||
    parserName === "rea_apify"
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

function buildResult(
  listing: ParsedListing,
  warnings: string[],
  method: ExtractListingResult["method"],
  parserName: string,
): ExtractListingResult {
  const finalized = finalizeListing(listing, warnings);
  return {
    listing: finalized,
    method,
    parserName,
    warnings: finalized.warnings,
  };
}

async function fetchAgencyHtml(url: string, warnings: string[]) {
  let method: "static_fetch" | "browserless_rendered" = "browserless_rendered";
  let html = "";

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
      if (warnings.length) {
        warnings.push(
          "Full page import was unavailable. Used a basic fetch of this page instead.",
        );
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Static fetch failed");
    }
  }

  return { html, method };
}

function listingFromUrlAddress(
  url: string,
  warnings: string[],
  addressHint?: Partial<ParsedListing> | null,
) {
  const urlAddress = addressHint ?? parseAddressFromListingUrl(url);
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
  const parserName = ruleParsed.parserName;
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

function reaImportMethod(provider: ReaImportProvider): ExtractListingResult["method"] {
  return provider === "apify" ? "apify_rea" : "brightdata_rea";
}

function reaImportParserName(provider: ReaImportProvider) {
  return provider === "apify" ? "rea_apify" : "rea_brightdata";
}

async function tryReaImportWithOptionalAgencyAgents(
  sourceUrl: string,
  addressHint: Partial<ParsedListing> | null | undefined,
  warnings: string[],
) {
  const reaImport = await tryReaImport(sourceUrl, addressHint);
  warnings.push(...reaImport.warnings);

  if (!reaImport.used || !reaImport.provider) {
    return null;
  }

  const method = reaImportMethod(reaImport.provider);
  const parserName = reaImportParserName(reaImport.provider);

  if (!isReaListingUrl(sourceUrl) && !isDomainListingUrl(sourceUrl)) {
    const agency = await enrichFromAgencySite(sourceUrl, reaImport.listing, warnings, {
      agentsOnly: true,
    });
    return buildResult(agency.listing, warnings, method, parserName);
  }

  return buildResult(reaImport.listing, warnings, method, parserName);
}

export type ExtractListingResult = {
  listing: ParsedListing;
  method:
    | "static_fetch"
    | "browserless_rendered"
    | "apify_rea"
    | "brightdata_rea"
    | "brightdata_unlocker";
  parserName: string;
  warnings: string[];
};

export type ExtractListingOptions = {
  /** REA rent discover + median band (slow; 2–3 min). */
  enrichRentalAppraisal?: boolean;
  /** Source URL used to exclude the subject from rental comparables. */
  subjectListingUrl?: string;
};

async function applyExtractOptions(
  result: ExtractListingResult,
  options?: ExtractListingOptions,
): Promise<ExtractListingResult> {
  if (!options?.enrichRentalAppraisal) {
    return result;
  }

  const listing = await enrichListingRentalAppraisal(result.listing, {
    subjectListingUrl: options.subjectListingUrl,
  });
  return {
    ...result,
    listing,
    warnings: listing.warnings,
  };
}

function domainImportMessage(method: "static_fetch" | "browserless_rendered" | "brightdata_unlocker") {
  if (method === "brightdata_unlocker") {
    return "Imported from Domain.com.au via Bright Data.";
  }

  if (method === "browserless_rendered") {
    return "Imported from Domain.com.au via browser fetch.";
  }

  return "Imported from Domain.com.au via static fetch.";
}

async function extractDomainListingUrl(
  url: string,
  urlAddressHint: ReturnType<typeof parseAddressFromListingUrl>,
  warnings: string[],
): Promise<ExtractListingResult> {
  const { listing: domainListing, warnings: domainWarnings, method: domainMethod } =
    await fetchDomainListingPage(url);
  warnings.push(...domainWarnings);

  let listing = domainListing;
  let parserName = "domain";

  if (!listing.address?.trim()) {
    if (urlAddressHint?.address?.trim()) {
      listing = mergeParsedListings(emptyListing(), {
        images: [],
        agents: [],
        confidence: urlAddressHint.confidence ?? "medium",
        warnings: urlAddressHint.warnings ?? [],
        ...urlAddressHint,
      });
      parserName = "domain_url";
      warnings.push(
        ...(urlAddressHint.warnings ?? []),
        "Could not read Domain listing data. Used address from listing URL.",
      );
    } else {
      throw new Error(
        "Unable to fetch listing HTML. Check the URL and try again, or enter details manually.",
      );
    }
  } else {
    warnings.push(domainImportMessage(domainMethod));
  }

  return buildResult(listing, warnings, domainMethod, parserName);
}

async function spfnAddressSeed(url: string, warnings: string[]) {
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

export async function extractListingFromUrl(
  url: string,
  inputOptions?: ExtractListingOptions,
): Promise<ExtractListingResult> {
  const options: ExtractListingOptions = {
    ...inputOptions,
    subjectListingUrl: url,
  };
  const warnings: string[] = [];
  const urlAddressHint = isSpfnListingUrl(url)
    ? await spfnAddressSeed(url, warnings)
    : parseAddressFromListingUrl(url);
  const preferDomain = hasBrightDataUnlockerConfig();

  if (isDomainListingUrl(url)) {
    return applyExtractOptions(
      await extractDomainListingUrl(url, urlAddressHint, warnings),
      options,
    );
  }

  let method: ExtractListingResult["method"] = "static_fetch";
  let parserName = resolveSiteParser(url)?.name ?? "generic";
  let domainPrimaryAttempted = false;

  const urlSeed = listingFromUrlAddress(url, warnings, urlAddressHint);
  let listing = urlSeed ?? emptyListing();

  if (urlSeed) {
    domainPrimaryAttempted = true;

    if (preferDomain) {
      const domainPrimary = await tryDomainListingPrimary(url, listing);
      listing = domainPrimary.listing;
      warnings.push(...domainPrimary.warnings);

      if (domainPrimary.used) {
        const agency = await enrichFromAgencySite(url, listing, warnings, {
          agentsOnly: true,
        });
        method = preferDomain ? "brightdata_unlocker" : agency.method;
        listing = agency.listing;
        if (agency.parserName) {
          parserName = "domain_primary";
        }

        warnings.push(
          "Used Domain.com.au for property details. Agency site was checked for listing agents.",
        );

        return applyExtractOptions(
          buildResult(listing, warnings, method, "domain_primary"),
          options,
        );
      }
    }

    if (hasReaImportConfig()) {
      const reaResult = await tryReaImportWithOptionalAgencyAgents(url, urlSeed, warnings);
      if (reaResult) {
        return applyExtractOptions(reaResult, options);
      }
    }

    if (!preferDomain) {
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

        return applyExtractOptions(
          buildResult(listing, warnings, method, "domain_primary"),
          options,
        );
      }
    }
  } else if (hasReaImportConfig()) {
    const reaResult = await tryReaImportWithOptionalAgencyAgents(
      url,
      urlAddressHint,
      warnings,
    );
    if (reaResult) {
      return applyExtractOptions(reaResult, options);
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

    return applyExtractOptions(buildResult(listing, warnings, method, parserName), options);
  }

  const checkpoint = isBotCheckpointHtml(html);
  const ruleParsed = parseListing(html, url);
  parserName = ruleParsed.parserName;
  listing = mergeParsedListings(listing, ruleParsed.listing);

  if (checkpoint && /security checkpoint/i.test(listing.title ?? "")) {
    listing = { ...listing, title: undefined };
  }

  if (!listing.address?.trim() && urlAddressHint?.address) {
    listing = mergeParsedListings(listing, {
      images: [],
      agents: [],
      confidence: urlAddressHint.confidence ?? "medium",
      warnings: urlAddressHint.warnings ?? [],
      ...urlAddressHint,
    });
    warnings.push(...(urlAddressHint.warnings ?? []));
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

      return applyExtractOptions(
        buildResult(
          listing,
          warnings,
          preferDomain ? "brightdata_unlocker" : method,
          parserName,
        ),
        options,
      );
    }
  }

  const domainFallback = await tryDomainListingFallback(url, listing, checkpoint);
  listing = domainFallback.listing;
  warnings.push(...domainFallback.warnings);

  if (domainFallback.used) {
    parserName = "domain_fallback";
    return applyExtractOptions(
      buildResult(
        listing,
        warnings,
        preferDomain ? "brightdata_unlocker" : method,
        parserName,
      ),
      options,
    );
  }

  if (hasReaImportConfig()) {
    const reaResult = await tryReaImportWithOptionalAgencyAgents(url, listing, warnings);
    if (reaResult) {
      return applyExtractOptions(reaResult, options);
    }
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

  return applyExtractOptions(buildResult(listing, warnings, method, parserName), options);
}
