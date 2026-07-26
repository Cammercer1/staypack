import type { ApifyReaListingRecord } from "@/lib/apify/types";
import {
  getApifyReaMaxListings,
  hasApifyReaConfig,
  scrapeApifyReaListingUrls,
  scrapeApifyReaRentSearchUrls,
} from "@/lib/apify/client";
import {
  getRapidApiReaMaxListings,
  hasRapidApiReaConfig,
  scrapeRapidApiReaListingUrls,
  scrapeRapidApiReaSearchUrls,
} from "@/lib/rapidapi/client";

export type ReaDataProvider = "rapidapi" | "apify";

export type ReaProviderResult = {
  records: ApifyReaListingRecord[];
  provider: ReaDataProvider;
};

type ReaSearchOptions = {
  searchUrls: string[];
  maxItems?: number;
  includeSurroundingSuburbs?: boolean;
  datasetItemLimit?: number;
};

export function getReaProviderOrder(): ReaDataProvider[] {
  const preferred = process.env.REA_PRIMARY_PROVIDER?.trim().toLowerCase();
  const available = {
    rapidapi: hasRapidApiReaConfig(),
    apify: hasApifyReaConfig(),
  };

  if (preferred === "apify") {
    return (["apify", "rapidapi"] as const).filter(
      (provider) => available[provider],
    );
  }
  return (["rapidapi", "apify"] as const).filter(
    (provider) => available[provider],
  );
}

export function hasReaDataProviderConfig() {
  return getReaProviderOrder().length > 0;
}

export function getPrimaryReaDataProvider(): ReaDataProvider | undefined {
  return getReaProviderOrder()[0];
}

export function getReaMaxListings() {
  return getPrimaryReaDataProvider() === "rapidapi"
    ? getRapidApiReaMaxListings()
    : getApifyReaMaxListings();
}

async function withProviderFallback(
  action: (provider: ReaDataProvider) => Promise<ApifyReaListingRecord[]>,
): Promise<ReaProviderResult> {
  const providers = getReaProviderOrder();
  if (!providers.length) {
    throw new Error("No REA data provider is configured");
  }

  let lastError: Error | null = null;
  for (const provider of providers) {
    try {
      return { records: await action(provider), provider };
    } catch (error) {
      lastError = error instanceof Error
        ? error
        : new Error(`${provider} REA request failed`);
      console.warn(
        `${provider} REA request failed${providers.length > 1 ? "; trying fallback provider" : ""}: ${lastError.message}`,
      );
    }
  }

  throw lastError ?? new Error("REA data request failed");
}

export async function scrapeReaSearchUrls(
  options: ReaSearchOptions,
): Promise<ReaProviderResult> {
  return withProviderFallback((provider) =>
    provider === "rapidapi"
      ? scrapeRapidApiReaSearchUrls(options)
      : scrapeApifyReaRentSearchUrls(options),
  );
}

export async function scrapeReaSearch({
  searchUrl,
  ...options
}: Omit<ReaSearchOptions, "searchUrls"> & { searchUrl: string }) {
  return scrapeReaSearchUrls({ ...options, searchUrls: [searchUrl] });
}

export async function scrapeReaListingUrls(
  listingUrls: string[],
): Promise<ReaProviderResult> {
  return withProviderFallback((provider) =>
    provider === "rapidapi"
      ? scrapeRapidApiReaListingUrls(listingUrls)
      : scrapeApifyReaListingUrls(listingUrls),
  );
}

export async function scrapeReaListingUrl(listingUrl: string) {
  const result = await scrapeReaListingUrls([listingUrl]);
  return {
    record: result.records[0] ?? null,
    provider: result.provider,
  };
}
