import {
  hasBrightDataReaConfig,
  scrapeBrightDataReaListing,
} from "@/lib/brightdata/client";
import type { ParsedListing } from "@/lib/types";
import { mergeParsedListings } from "@/lib/scraping/index";
import { MIN_DELIVERY_DESCRIPTION_CHARS } from "@/lib/scraping/listingCompleteness";
import {
  findReaListingUrlCandidates,
  prependDirectReaUrl,
} from "@/lib/scraping/rea/findReaListingUrlCandidates";
import {
  isReaListingUrl,
  normalizeReaListingUrl,
  reaUrlFormat,
} from "@/lib/scraping/rea/reaUrlMatch";
import { hasBrightDataUnlockerConfig } from "@/lib/brightdata/client";
import { parseBrightDataReaRecord } from "@/lib/scraping/rea/parseBrightDataRea";
import { emptyListing } from "@/lib/scraping/parsers/utils";

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

  const discovered = await findReaListingUrlCandidates(matchInput);
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

async function scrapeBestReaListingFromCandidates(
  urls: string[],
  warnings: string[],
): Promise<{
  parsed: ParsedListing;
  reaUrl: string;
} | null> {
  let fallback: { parsed: ParsedListing; reaUrl: string } | null = null;

  for (let index = 0; index < urls.length; index += 1) {
    const reaUrl = urls[index]!;
    const remaining = urls.slice(index + 1);

    try {
      const record = await scrapeBrightDataReaListing(reaUrl);
      if (!record) {
        warnings.push(`Bright Data returned no REA listing data for ${reaUrl}.`);
        continue;
      }

      const parsed = parseBrightDataReaRecord(record);
      if (!isUsableReaRecord(parsed)) {
        warnings.push(`Bright Data REA scrape for ${reaUrl} did not return a usable address.`);
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
        warnings.push(
          `REA dataset returned thin data for ${reaUrl}; trying next discovered URL.`,
        );
        continue;
      }

      return { parsed, reaUrl };
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Bright Data REA scrape failed for ${reaUrl}: ${error.message}`
          : `Bright Data REA scrape failed for ${reaUrl}.`,
      );
    }
  }

  return fallback;
}

export async function tryReaBrightDataImport(
  sourceUrl: string,
  addressHint?: Partial<ParsedListing> | null,
): Promise<{
  used: boolean;
  listing: ParsedListing;
  reaUrl?: string;
  warnings: string[];
}> {
  const warnings: string[] = [];

  if (!hasBrightDataReaConfig()) {
    return { used: false, listing: emptyListing(), warnings };
  }

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

  const scraped = await scrapeBestReaListingFromCandidates(reaUrls, warnings);
  if (!scraped) {
    warnings.push("Bright Data REA scrape did not return usable listing data.");
    return { used: false, listing: emptyListing(), warnings };
  }

  const merged = addressHint
    ? mergeParsedListings(
        {
          images: [],
          agents: [],
          confidence: addressHint.confidence ?? "medium",
          warnings: addressHint.warnings ?? [],
          ...addressHint,
        },
        scraped.parsed,
      )
    : scraped.parsed;

  warnings.push(`Imported from realestate.com.au via Bright Data: ${scraped.reaUrl}`);

  return {
    used: true,
    listing: merged,
    reaUrl: scraped.reaUrl,
    warnings,
  };
}
