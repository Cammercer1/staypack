import {
  hasBrightDataReaConfig,
  scrapeBrightDataReaListing,
} from "@/lib/brightdata/client";
import type { ParsedListing } from "@/lib/types";
import { mergeParsedListings } from "@/lib/scraping/index";
import { findReaListingUrl, isReaListingUrl, normalizeReaListingUrl } from "@/lib/scraping/rea/findReaListingUrl";
import { parseBrightDataReaRecord } from "@/lib/scraping/rea/parseBrightDataRea";
import { emptyListing } from "@/lib/scraping/parsers/utils";

export function hasSearchableReaAddress(listing: Partial<ParsedListing>) {
  return Boolean(
    listing.suburb?.trim() &&
      listing.state?.trim() &&
      listing.postcode?.trim(),
  );
}

async function resolveReaListingUrl(
  sourceUrl: string,
  addressHint?: Partial<ParsedListing> | null,
) {
  const direct = normalizeReaListingUrl(sourceUrl);
  if (direct) {
    return direct;
  }

  if (!addressHint || !hasSearchableReaAddress(addressHint)) {
    return null;
  }

  return findReaListingUrl({
    address: addressHint.address,
    suburb: addressHint.suburb,
    state: addressHint.state,
    postcode: addressHint.postcode,
  });
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

  const reaUrl = await resolveReaListingUrl(sourceUrl, addressHint);
  if (!reaUrl) {
    if (isReaListingUrl(sourceUrl)) {
      warnings.push("Could not normalize the realestate.com.au listing URL.");
    } else if (addressHint && hasSearchableReaAddress(addressHint)) {
      warnings.push(
        "Could not find a matching realestate.com.au listing for this address. Set BRIGHTDATA_UNLOCKER_ZONE to enable REA search discovery.",
      );
    }
    return { used: false, listing: emptyListing(), warnings };
  }

  try {
    const record = await scrapeBrightDataReaListing(reaUrl);
    if (!record) {
      warnings.push("Bright Data returned no REA listing data.");
      return { used: false, listing: emptyListing(), reaUrl, warnings };
    }

    const parsed = parseBrightDataReaRecord(record);
    if (!parsed.address?.trim()) {
      warnings.push("Bright Data REA scrape did not return a usable address.");
      return { used: false, listing: parsed, reaUrl, warnings };
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
          parsed,
        )
      : parsed;

    warnings.push(`Imported from realestate.com.au via Bright Data: ${reaUrl}`);

    return {
      used: true,
      listing: merged,
      reaUrl,
      warnings,
    };
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Bright Data REA scrape failed: ${error.message}`
        : "Bright Data REA scrape failed",
    );
    return { used: false, listing: emptyListing(), reaUrl, warnings };
  }
}
