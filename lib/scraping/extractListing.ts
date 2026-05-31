import type { ParsedListing } from "@/lib/types";
import { parseListingFromHtml } from "@/lib/openai/parseListingFromHtml";
import { fetchRenderedHtml } from "@/lib/scraping/fetchRenderedHtml";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import { mergeParsedListings, parseListing } from "@/lib/scraping/index";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import { tryDomainListingFallback } from "@/lib/scraping/domainFallback";
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
  if (checkpoint || parserName === "domain_fallback") {
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

export type ExtractListingResult = {
  listing: ParsedListing;
  method: "static_fetch" | "browserless_rendered";
  parserName: string;
  warnings: string[];
};

export async function extractListingFromUrl(url: string): Promise<ExtractListingResult> {
  const warnings: string[] = [];
  let method: ExtractListingResult["method"] = "browserless_rendered";
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

  if (!html) {
    const urlAddress = parseAddressFromListingUrl(url);
    if (!urlAddress?.address?.trim()) {
      throw new Error(
        "Unable to fetch listing HTML. Check the URL and try again, or enter details manually.",
      );
    }

    let listing = mergeParsedListings(
      {
        images: [],
        agents: [],
        confidence: urlAddress.confidence ?? "medium",
        warnings: [],
      },
      {
        images: [],
        agents: [],
        confidence: urlAddress.confidence ?? "medium",
        warnings: urlAddress.warnings ?? [],
        ...urlAddress,
      },
    );

    warnings.push(
      "Could not fetch the agency listing page. Used the address from the URL and searched Domain.com.au for matching data.",
    );

    const domainFallback = await tryDomainListingFallback(url, listing, true);
    listing = domainFallback.listing;
    warnings.push(...domainFallback.warnings);

    listing = {
      ...listing,
      displayPrice: normalizeDisplayPrice(listing.displayPrice),
      warnings: [...new Set([...warnings, ...listing.warnings])],
    };

    return {
      listing,
      method,
      parserName: domainFallback.used ? "domain_fallback" : resolveSiteParser(url)?.name ?? "url_address",
      warnings: listing.warnings,
    };
  }

  const checkpoint = isBotCheckpointHtml(html);

  let ruleParsed = parseListing(html, url);
  let parserName = ruleParsed.parserName;
  let listing = ruleParsed.listing;

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

  const domainFallback = await tryDomainListingFallback(url, listing, checkpoint);
  listing = domainFallback.listing;
  warnings.push(...domainFallback.warnings);

  if (domainFallback.used) {
    parserName = "domain_fallback";
  }

  const skipAi = shouldSkipAiEnrichment(url, listing, parserName, checkpoint);

  if (!domainFallback.used && !skipAi) {
    try {
      const aiListing = await parseListingFromHtml({
        html,
        url,
        fallback: ruleParsed.listing,
      });
      listing = mergeParsedListings(listing, aiListing);
      parserName = "openai";
      if (aiListing.warnings.length) {
        warnings.push(...aiListing.warnings);
      }
    } catch (error) {
      warnings.push(
        error instanceof Error ? error.message : "AI listing parse failed",
      );
      listing = {
        ...listing,
        warnings: [
          ...listing.warnings,
          "Automatic extraction failed. Review the prefilled fields carefully.",
        ],
      };
    }
  } else if (skipAi && !domainFallback.used) {
    const reason = checkpoint
      ? "agency site returned a bot checkpoint page"
      : parserName === "domain"
        ? "Domain listing data was complete"
        : "listing data was already sufficient";
    warnings.push(`Skipped AI enrichment because the ${reason}.`);
  }

  listing = {
    ...listing,
    displayPrice: normalizeDisplayPrice(listing.displayPrice),
    warnings: [...new Set([...warnings, ...listing.warnings])],
  };

  if (!listing.title && !listing.description && listing.images.length === 0) {
    listing.warnings.push("Limited listing data extracted. Please review manually.");
  }

  return {
    listing,
    method,
    parserName,
    warnings: listing.warnings,
  };
}
