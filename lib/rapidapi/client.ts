import type { ApifyReaListingRecord } from "@/lib/apify/types";
import { loadComparableSearchThroughCache } from "@/lib/apify/comparableSearchCache";
import { rapidApiReaListingToRecord } from "@/lib/rapidapi/normalizeRea";
import type {
  RapidApiReaDetailResponse,
  RapidApiReaSearchResponse,
} from "@/lib/rapidapi/types";

const DEFAULT_API_HOST = "realestate-com-au4.p.rapidapi.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_LISTINGS = 100;
const DEFAULT_MAX_DATASET_ITEMS = 100;
const DEFAULT_MAX_CONCURRENCY = 4;
const DEFAULT_MAX_RETRIES = 1;

type RapidApiSearchType = "For_Sale" | "For_Rent" | "Sold";
type RapidApiSortOrder =
  | "Recommended"
  | "Newest"
  | "Oldest"
  | "Price_Low_to_High"
  | "Price_High_to_Low"
  | "Most_Recently_Sold"
  | "Oldest_Sold";

type RapidApiSearchOptions = {
  resultCount: number;
  includeSurroundingSuburbs: boolean;
};

class RapidApiHttpError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "RapidApiHttpError";
  }
}

function positiveIntegerFromEnv(
  name: string,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  const configured = Number(process.env[name]);
  if (!Number.isFinite(configured) || configured <= 0) return fallback;
  return Math.min(Math.round(configured), maximum);
}

export function getRapidApiReaKey() {
  return (
    process.env.RAPIDAPI_REA_KEY?.trim() ||
    process.env.RAPIDAPI_KEY?.trim() ||
    ""
  );
}

export function getRapidApiReaHost() {
  return process.env.RAPIDAPI_REA_HOST?.trim() || DEFAULT_API_HOST;
}

export function getRapidApiReaMaxListings() {
  return positiveIntegerFromEnv(
    "RAPIDAPI_REA_MAX_LISTINGS",
    DEFAULT_MAX_LISTINGS,
    200,
  );
}

function getRapidApiReaTimeoutMs() {
  return positiveIntegerFromEnv(
    "RAPIDAPI_REA_TIMEOUT_MS",
    DEFAULT_TIMEOUT_MS,
  );
}

function getRapidApiReaMaxConcurrency() {
  return positiveIntegerFromEnv(
    "RAPIDAPI_REA_MAX_CONCURRENCY",
    DEFAULT_MAX_CONCURRENCY,
    10,
  );
}

function getRapidApiReaMaxRetries() {
  return positiveIntegerFromEnv(
    "RAPIDAPI_REA_MAX_RETRIES",
    DEFAULT_MAX_RETRIES,
    3,
  );
}

export function hasRapidApiReaConfig() {
  return Boolean(getRapidApiReaKey());
}

function channelFromUrl(url: URL): "rent" | "buy" | "sold" {
  const channel = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (channel === "rent" || channel === "sold") return channel;
  return "buy";
}

function searchTypeForChannel(channel: "rent" | "buy" | "sold"): RapidApiSearchType {
  if (channel === "rent") return "For_Rent";
  if (channel === "sold") return "Sold";
  return "For_Sale";
}

function sortOrderForUrl(
  url: URL,
  channel: "rent" | "buy" | "sold",
): RapidApiSortOrder {
  const activeSort = url.searchParams.get("activeSort")?.trim().toLowerCase();
  if (activeSort === "list-date") return "Newest";
  if (activeSort === "price-low") return "Price_Low_to_High";
  if (activeSort === "price-high") return "Price_High_to_Low";
  if (activeSort === "solddate") return "Most_Recently_Sold";
  return channel === "sold" ? "Most_Recently_Sold" : "Recommended";
}

function pageFromUrl(url: URL) {
  const match = url.pathname.match(/\/list-(\d+)(?:\/|$)/i);
  return match?.[1] ?? "1";
}

function pathSearchSegment(url: URL) {
  return decodeURIComponent(url.pathname).toLowerCase();
}

function bedroomsFromUrl(url: URL) {
  const match = pathSearchSegment(url).match(/with-(\d+)-bedrooms?/);
  if (!match?.[1]) return undefined;
  const bedrooms = Number.parseInt(match[1], 10);
  return Number.isFinite(bedrooms) ? bedrooms : undefined;
}

function priceRangeFromUrl(url: URL) {
  const match = pathSearchSegment(url).match(
    /between-(\d+)-and-(\d+)-in-/,
  );
  return match?.[1] && match[2]
    ? `min:${match[1]},max:${match[2]}`
    : undefined;
}

function propertyTypesFromUrl(url: URL) {
  const match = pathSearchSegment(url).match(
    /\/property-([a-z0-9+_-]+?)(?:-with-|-in-)/,
  );
  if (!match?.[1]) return undefined;

  const mapped = match[1]
    .split("+")
    .map((value) => {
      const normalized = value.replace(/_/g, "-");
      if (normalized === "unitblock" || normalized === "block-of-units") {
        return "Block_of_Units";
      }
      if (normalized === "townhome" || normalized === "townhomes") {
        return "Townhouse";
      }
      return normalized
        .split("-")
        .map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : "")
        .join("_");
    })
    .filter(Boolean);

  return mapped.length ? [...new Set(mapped)].join(",") : undefined;
}

function setOptionalParam(
  params: URLSearchParams,
  name: string,
  value: string | null | undefined,
) {
  const trimmed = value?.trim();
  if (trimmed) params.set(name, trimmed);
}

export function buildRapidApiReaSearchRequestUrl(
  searchUrl: string,
  options: RapidApiSearchOptions,
) {
  const source = new URL(searchUrl);
  const channel = channelFromUrl(source);
  const requestUrl = new URL(
    `https://${getRapidApiReaHost()}/search/byurl`,
  );
  const params = requestUrl.searchParams;
  const bedrooms = bedroomsFromUrl(source);
  const baths = source.searchParams.get("numBaths");
  const carSpaces = source.searchParams.get("numParkingSpaces");
  const constructionStatus = source.searchParams.get("constructionStatus");
  const keywords =
    source.searchParams.get("keywords") ??
    source.searchParams.get("checkedFeatures");

  params.set("url", searchUrl);
  params.set("page", pageFromUrl(source));
  params.set("resultCount", String(Math.min(options.resultCount, 200)));
  params.set("sortOrder", sortOrderForUrl(source, channel));
  params.set("searchType", searchTypeForChannel(channel));
  params.set(
    "surroundingSuburbs",
    options.includeSurroundingSuburbs ? "true" : "false",
  );

  setOptionalParam(params, "propertyType", propertyTypesFromUrl(source));
  setOptionalParam(params, "priceRange", priceRangeFromUrl(source));
  if (bedrooms != null) {
    params.set("bedsRange", `min:${bedrooms},max:${bedrooms}`);
  }
  if (baths) params.set("bathsRange", `min:${baths}`);
  if (carSpaces) params.set("carSpacesRange", `min:${carSpaces}`);
  setOptionalParam(params, "constructionStatus", constructionStatus);
  setOptionalParam(params, "keywords", keywords);

  return requestUrl;
}

async function rapidApiFetchJson<T>(url: URL): Promise<T> {
  const apiKey = getRapidApiReaKey();
  if (!apiKey) throw new Error("RapidAPI REA is not configured");

  const maxRetries = getRapidApiReaMaxRetries();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getRapidApiReaTimeoutMs());

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": getRapidApiReaHost(),
        },
      });
      const text = await response.text();
      if (response.ok) {
        return JSON.parse(text) as T;
      }

      const detail = (() => {
        try {
          const payload = JSON.parse(text) as { message?: string; error?: string };
          return payload.message ?? payload.error;
        } catch {
          return text.slice(0, 240);
        }
      })();
      const retryable = response.status === 429 || response.status >= 500;
      lastError = new RapidApiHttpError(
        `RapidAPI REA request failed (${response.status})${detail ? `: ${detail}` : ""}`,
        retryable,
      );
      if (!retryable || attempt === maxRetries) throw lastError;

      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const retryMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1_000, 5_000)
        : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("RapidAPI REA request failed");
      if (
        attempt === maxRetries ||
        lastError.name === "AbortError" ||
        (lastError instanceof RapidApiHttpError && !lastError.retryable)
      ) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("RapidAPI REA request failed");
}

async function mapWithConcurrency<T, U>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<U>,
) {
  const results = new Array<U>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]!, index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(1, values.length)) },
      () => worker(),
    ),
  );
  return results;
}

function dedupeRecords(
  records: ApifyReaListingRecord[],
  limit: number,
) {
  const seen = new Set<string>();
  const deduped: ApifyReaListingRecord[] = [];
  for (const record of records) {
    const key = record.listingId?.trim() || record.url?.trim();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    deduped.push(record);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

export async function scrapeRapidApiReaListingUrl(
  listingUrl: string,
): Promise<ApifyReaListingRecord | null> {
  const requestUrl = new URL(
    `https://${getRapidApiReaHost()}/details/byurl`,
  );
  requestUrl.searchParams.set("url", listingUrl);
  const response = await rapidApiFetchJson<RapidApiReaDetailResponse>(requestUrl);
  return response.detail
    ? rapidApiReaListingToRecord(response.detail)
    : null;
}

export async function scrapeRapidApiReaListingUrls(
  listingUrls: string[],
): Promise<ApifyReaListingRecord[]> {
  const records = await mapWithConcurrency(
    listingUrls,
    getRapidApiReaMaxConcurrency(),
    scrapeRapidApiReaListingUrl,
  );
  return records.filter(
    (record): record is ApifyReaListingRecord => Boolean(record),
  );
}

export async function scrapeRapidApiReaSearchUrls({
  searchUrls,
  maxItems = getRapidApiReaMaxListings(),
  includeSurroundingSuburbs = false,
  datasetItemLimit,
}: {
  searchUrls: string[];
  maxItems?: number;
  includeSurroundingSuburbs?: boolean;
  datasetItemLimit?: number;
}): Promise<ApifyReaListingRecord[]> {
  const normalizedMaxItems = Math.min(
    Math.max(1, Math.round(maxItems)),
    200,
  );
  const resultLimit = datasetItemLimit == null
    ? normalizedMaxItems
    : Math.min(
        Math.max(1, Math.round(datasetItemLimit)),
        DEFAULT_MAX_DATASET_ITEMS,
      );
  const itemsPerUrl = datasetItemLimit == null
    ? normalizedMaxItems
    : Math.max(
        1,
        Math.min(
          normalizedMaxItems,
          Math.floor(resultLimit / Math.max(1, searchUrls.length)),
        ),
      );

  return loadComparableSearchThroughCache({
    request: {
      provider: "rapidapi_rea",
      actorId: getRapidApiReaHost(),
      startUrls: searchUrls,
      maxItems: normalizedMaxItems,
      includeSurroundingSuburbs,
      datasetItemLimit: datasetItemLimit ?? null,
      datasetFields: "rapidapi-rea-normalized-v1",
    },
    loader: async () => {
      const batches = await mapWithConcurrency(
        searchUrls,
        getRapidApiReaMaxConcurrency(),
        async (searchUrl) => {
          const requestUrl = buildRapidApiReaSearchRequestUrl(searchUrl, {
            resultCount: itemsPerUrl,
            includeSurroundingSuburbs,
          });
          const response =
            await rapidApiFetchJson<RapidApiReaSearchResponse>(requestUrl);
          return (response.searchResults ?? []).map((listing) =>
            rapidApiReaListingToRecord(listing, searchUrl),
          );
        },
      );
      return dedupeRecords(batches.flat(), resultLimit);
    },
  });
}
