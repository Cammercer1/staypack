import {
  hasBrightDataReaConfig,
  hasBrightDataUnlockerConfig,
  scrapeBrightDataReaListing,
} from "@/lib/brightdata/client";
import {
  hasApifyReaConfig,
  scrapeApifyReaListingUrl,
} from "@/lib/apify/client";
import type { ParsedListing } from "@/lib/types";
import { mergeParsedListings } from "@/lib/scraping/index";
import { MIN_DELIVERY_DESCRIPTION_CHARS } from "@/lib/scraping/listingCompleteness";
import {
  findReaListingUrlCandidates,
  prependDirectReaUrl,
} from "@/lib/scraping/rea/findReaListingUrlCandidates";
import { parseApifyReaRecord } from "@/lib/scraping/rea/parseApifyRea";
import {
  isReaListingUrl,
  normalizeReaListingUrl,
  reaUrlFormat,
} from "@/lib/scraping/rea/reaUrlMatch";
import { parseBrightDataReaRecord } from "@/lib/scraping/rea/parseBrightDataRea";
import { emptyListing } from "@/lib/scraping/parsers/utils";

export type ReaImportProvider = "apify" | "brightdata";

export type ReaImportResult = {
  used: boolean;
  listing: ParsedListing;
  reaUrl?: string;
  warnings: string[];
  provider?: ReaImportProvider;
};

export function hasReaImportConfig() {
  return hasApifyReaConfig() || hasBrightDataReaConfig();
}

export function hasSearchableReaAddress(listing: Partial<ParsedListing>) {
  return Boolean(
    listing.suburb?.trim() &&
      listing.state?.trim() &&
      listing.postcode?.trim(),
  );
}

function addressMatchInput(addressHint?: Partial<ParsedListing> | null) {
  if (!addressHint) {
    return null;
  }

  return {
    address: addressHint.address,
    suburb: addressHint.suburb,
    state: addressHint.state,
    postcode: addressHint.postcode,
  };
}

async function resolveReaListingUrlCandidates(
  sourceUrl: string,
  addressHint?: Partial<ParsedListing> | null,
): Promise<string[]> {
  const direct = normalizeReaListingUrl(sourceUrl);
  const matchInput = addressMatchInput(addressHint);

  if (!matchInput) {
    return direct ? [direct] : [];
  }

  let discovered: string[] = [];
  try {
    discovered = await findReaListingUrlCandidates(matchInput);
  } catch {
    // Unlocker unavailable — still scrape direct REA URL when present.
  }

  return prependDirectReaUrl(discovered, direct);
}

function reaRecordQuality(parsed: ParsedListing) {
  const descriptionLength = parsed.description?.trim().length ?? 0;
  return {
    hasAddress: Boolean(parsed.address?.trim()),
    hasDescription: descriptionLength >= MIN_DELIVERY_DESCRIPTION_CHARS,
    descriptionLength,
    imageCount: parsed.images.length,
  };
}

function isStrongReaRecord(parsed: ParsedListing) {
  const quality = reaRecordQuality(parsed);
  return quality.hasAddress && quality.hasDescription;
}

function isUsableReaRecord(parsed: ParsedListing) {
  return Boolean(parsed.address?.trim());
}

function shouldTryNextReaUrl(
  parsed: ParsedListing,
  url: string,
  remainingUrls: string[],
) {
  if (!remainingUrls.length) {
    return false;
  }

  const quality = reaRecordQuality(parsed);
  if (quality.hasDescription) {
    return false;
  }

  if (reaUrlFormat(url) === "address_slug") {
    return remainingUrls.some((candidate) => reaUrlFormat(candidate) !== "address_slug");
  }

  return !quality.hasDescription;
}

type ReaCandidateScraper = {
  provider: ReaImportProvider;
  scrape: (reaUrl: string) => Promise<ParsedListing | null>;
  emptyRecordMessage: (reaUrl: string) => string;
  unusableMessage: (reaUrl: string) => string;
  failedMessage: (reaUrl: string, error: unknown) => string;
  thinDataMessage: string;
};

async function scrapeBestReaListingFromCandidates(
  urls: string[],
  warnings: string[],
  scraper: ReaCandidateScraper,
): Promise<{
  parsed: ParsedListing;
  reaUrl: string;
} | null> {
  let fallback: { parsed: ParsedListing; reaUrl: string } | null = null;

  for (let index = 0; index < urls.length; index += 1) {
    const reaUrl = urls[index]!;
    const remaining = urls.slice(index + 1);

    try {
      const parsed = await scraper.scrape(reaUrl);
      if (!parsed) {
        warnings.push(scraper.emptyRecordMessage(reaUrl));
        continue;
      }

      if (!isUsableReaRecord(parsed)) {
        warnings.push(scraper.unusableMessage(reaUrl));
        continue;
      }

      if (isStrongReaRecord(parsed)) {
        return { parsed, reaUrl };
      }

      if (
        !fallback ||
        reaRecordQuality(parsed).descriptionLength >
          reaRecordQuality(fallback.parsed).descriptionLength ||
        (reaRecordQuality(parsed).descriptionLength ===
          reaRecordQuality(fallback.parsed).descriptionLength &&
          parsed.images.length > fallback.parsed.images.length)
      ) {
        fallback = { parsed, reaUrl };
      }

      if (shouldTryNextReaUrl(parsed, reaUrl, remaining)) {
        warnings.push(scraper.thinDataMessage);
        continue;
      }

      return { parsed, reaUrl };
    } catch (error) {
      warnings.push(scraper.failedMessage(reaUrl, error));
    }
  }

  return fallback;
}

const APIFY_SCRAPER: ReaCandidateScraper = {
  provider: "apify",
  scrape: async (reaUrl) => {
    const record = await scrapeApifyReaListingUrl(reaUrl);
    return record ? parseApifyReaRecord(record) : null;
  },
  emptyRecordMessage: (reaUrl) => `Apify returned no REA listing data for ${reaUrl}.`,
  unusableMessage: (reaUrl) =>
    `Apify REA scrape for ${reaUrl} did not return a usable address.`,
  failedMessage: (reaUrl, error) =>
    error instanceof Error
      ? `Apify REA scrape failed for ${reaUrl}: ${error.message}`
      : `Apify REA scrape failed for ${reaUrl}.`,
  thinDataMessage: "Apify REA scrape returned thin data; trying next discovered URL.",
};

const BRIGHTDATA_SCRAPER: ReaCandidateScraper = {
  provider: "brightdata",
  scrape: async (reaUrl) => {
    const record = await scrapeBrightDataReaListing(reaUrl);
    return record ? parseBrightDataReaRecord(record) : null;
  },
  emptyRecordMessage: (reaUrl) => `Bright Data returned no REA listing data for ${reaUrl}.`,
  unusableMessage: (reaUrl) =>
    `Bright Data REA scrape for ${reaUrl} did not return a usable address.`,
  failedMessage: (reaUrl, error) =>
    error instanceof Error
      ? `Bright Data REA scrape failed for ${reaUrl}: ${error.message}`
      : `Bright Data REA scrape failed for ${reaUrl}.`,
  thinDataMessage: "REA dataset returned thin data; trying next discovered URL.",
};

function mergeReaImportListing(
  scraped: ParsedListing,
  addressHint?: Partial<ParsedListing> | null,
) {
  if (!addressHint) {
    return scraped;
  }

  return mergeParsedListings(
    {
      images: [],
      agents: [],
      confidence: addressHint.confidence ?? "medium",
      warnings: addressHint.warnings ?? [],
      ...addressHint,
    },
    scraped,
  );
}

async function tryReaProviderImport(
  sourceUrl: string,
  addressHint: Partial<ParsedListing> | null | undefined,
  scraper: ReaCandidateScraper,
): Promise<ReaImportResult> {
  const warnings: string[] = [];
  const reaUrls = await resolveReaListingUrlCandidates(sourceUrl, addressHint);

  if (!reaUrls.length) {
    if (isReaListingUrl(sourceUrl)) {
      warnings.push("Could not normalize the realestate.com.au listing URL.");
    } else if (addressHint && (addressHint.address?.trim() || addressHint.suburb?.trim())) {
      warnings.push(
        hasBrightDataUnlockerConfig()
          ? "Could not find a matching realestate.com.au listing for this address (Google SERP and REA search)."
          : "Could not find a matching realestate.com.au listing. Set BRIGHTDATA_UNLOCKER_ZONE for Google/REA discovery.",
      );
    }
    return { used: false, listing: emptyListing(), warnings };
  }

  if (reaUrls.length > 1) {
    warnings.push(
      `Discovered ${reaUrls.length} REA listing URL(s); trying best match first (${reaUrlFormat(reaUrls[0]!)}).`,
    );
  }

  const scraped = await scrapeBestReaListingFromCandidates(reaUrls, warnings, scraper);
  if (!scraped) {
    const providerLabel = scraper.provider === "apify" ? "Apify" : "Bright Data";
    warnings.push(`${providerLabel} REA scrape did not return usable listing data.`);
    return { used: false, listing: emptyListing(), warnings };
  }

  const merged = mergeReaImportListing(scraped.parsed, addressHint);
  const providerLabel = scraper.provider === "apify" ? "Apify" : "Bright Data";

  warnings.push(
    `Imported from realestate.com.au via ${providerLabel}: ${scraped.reaUrl}`,
  );

  return {
    used: true,
    listing: merged,
    reaUrl: scraped.reaUrl,
    warnings,
    provider: scraper.provider,
  };
}

export async function tryReaApifyImport(
  sourceUrl: string,
  addressHint?: Partial<ParsedListing> | null,
): Promise<ReaImportResult> {
  if (!hasApifyReaConfig()) {
    return { used: false, listing: emptyListing(), warnings: [] };
  }

  return tryReaProviderImport(sourceUrl, addressHint, APIFY_SCRAPER);
}

export async function tryReaBrightDataImport(
  sourceUrl: string,
  addressHint?: Partial<ParsedListing> | null,
): Promise<ReaImportResult> {
  if (!hasBrightDataReaConfig()) {
    return { used: false, listing: emptyListing(), warnings: [] };
  }

  return tryReaProviderImport(sourceUrl, addressHint, BRIGHTDATA_SCRAPER);
}

export async function tryReaImport(
  sourceUrl: string,
  addressHint?: Partial<ParsedListing> | null,
): Promise<ReaImportResult> {
  const apifyResult = await tryReaApifyImport(sourceUrl, addressHint);
  if (apifyResult.used) {
    return apifyResult;
  }

  const brightDataResult = await tryReaBrightDataImport(sourceUrl, addressHint);
  if (brightDataResult.used) {
    return brightDataResult;
  }

  return {
    used: false,
    listing: emptyListing(),
    warnings: [...apifyResult.warnings, ...brightDataResult.warnings],
  };
}
