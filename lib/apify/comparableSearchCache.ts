import { createHash } from "node:crypto";
import type { ApifyReaListingRecord } from "@/lib/apify/types";
import { createAdminClient } from "@/lib/supabase/admin";

const CACHE_KEY_VERSION = 1;
const CACHE_RETENTION_MONTHS = 12;
const DEFAULT_RENT_TTL_HOURS = 72;
const DEFAULT_BUY_TTL_HOURS = 168;
const DEFAULT_SOLD_TTL_HOURS = 720;
const FALSE_ENV_VALUES = new Set(["0", "false", "no", "off"]);

export type ApifyComparableSearchRequest = {
  actorId: string;
  startUrls: string[];
  maxItems: number;
  includeSurroundingSuburbs: boolean;
  datasetItemLimit: number | null;
  datasetFields: string;
};

export type ComparableSearchCacheStore = {
  get: (
    cacheKey: string,
  ) => Promise<ApifyReaListingRecord[] | null>;
  set: (
    cacheKey: string,
    request: ApifyComparableSearchRequest,
    records: ApifyReaListingRecord[],
  ) => Promise<void>;
};

const inFlightSearches = new Map<
  string,
  Promise<ApifyReaListingRecord[]>
>();

function positiveNumberFromEnv(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : fallback;
}

function searchChannel(url: string): "rent" | "buy" | "sold" | "unknown" {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.startsWith("/rent/")) return "rent";
    if (pathname.startsWith("/buy/")) return "buy";
    if (pathname.startsWith("/sold/")) return "sold";
  } catch {
    // The request still has a deterministic cache key; use the shortest TTL.
  }
  return "unknown";
}

export function comparableSearchCacheTtlMs(startUrls: string[]) {
  const hoursByChannel = {
    rent: positiveNumberFromEnv(
      "APIFY_REA_RENT_CACHE_TTL_HOURS",
      DEFAULT_RENT_TTL_HOURS,
    ),
    buy: positiveNumberFromEnv(
      "APIFY_REA_BUY_CACHE_TTL_HOURS",
      DEFAULT_BUY_TTL_HOURS,
    ),
    sold: positiveNumberFromEnv(
      "APIFY_REA_SOLD_CACHE_TTL_HOURS",
      DEFAULT_SOLD_TTL_HOURS,
    ),
    unknown: positiveNumberFromEnv(
      "APIFY_REA_RENT_CACHE_TTL_HOURS",
      DEFAULT_RENT_TTL_HOURS,
    ),
  } as const;

  const ttlHours = startUrls.length > 0
    ? Math.min(...startUrls.map((url) => hoursByChannel[searchChannel(url)]))
    : hoursByChannel.unknown;
  return ttlHours * 60 * 60 * 1000;
}

export function buildComparableSearchCacheKey(
  request: ApifyComparableSearchRequest,
) {
  const canonicalRequest = JSON.stringify({
    version: CACHE_KEY_VERSION,
    actorId: request.actorId,
    startUrls: request.startUrls.map((url) => url.trim()),
    maxItems: request.maxItems,
    includeSurroundingSuburbs: request.includeSurroundingSuburbs,
    datasetItemLimit: request.datasetItemLimit,
    datasetFields: request.datasetFields,
  });
  const digest = createHash("sha256").update(canonicalRequest).digest("hex");
  return `apify-rea:${CACHE_KEY_VERSION}:${digest}`;
}

export function hasComparableSearchCacheConfig() {
  const enabled = process.env.APIFY_REA_COMPARABLE_CACHE_ENABLED
    ?.trim()
    .toLowerCase();
  if (enabled && FALSE_ENV_VALUES.has(enabled)) {
    return false;
  }

  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function isListingRecordArray(value: unknown): value is ApifyReaListingRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => Boolean(item) && typeof item === "object" && !Array.isArray(item),
    )
  );
}

function databaseComparableSearchCacheStore(): ComparableSearchCacheStore | null {
  if (!hasComparableSearchCacheConfig()) {
    return null;
  }

  return {
    async get(cacheKey) {
      const admin = createAdminClient();
      const now = new Date().toISOString();
      const { data, error } = await admin
        .from("comparable_search_cache")
        .select("records_json")
        .eq("cache_key", cacheKey)
        .gt("fresh_until", now)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data || !isListingRecordArray(data.records_json)) return null;
      return data.records_json;
    },

    async set(cacheKey, request, records) {
      if (records.length === 0) return;

      const admin = createAdminClient();
      const now = new Date();
      const fetchedAt = now.toISOString();
      const freshUntil = new Date(
        now.getTime() + comparableSearchCacheTtlMs(request.startUrls),
      ).toISOString();
      const expiresAtDate = new Date(now);
      expiresAtDate.setUTCMonth(
        expiresAtDate.getUTCMonth() + CACHE_RETENTION_MONTHS,
      );
      const expiresAt = expiresAtDate.toISOString();
      const { error } = await admin.from("comparable_search_cache").upsert(
        {
          cache_key: cacheKey,
          provider: "apify_rea",
          actor_id: request.actorId,
          request_json: request,
          records_json: records,
          item_count: records.length,
          fetched_at: fetchedAt,
          fresh_until: freshUntil,
          expires_at: expiresAt,
        },
        { onConflict: "cache_key" },
      );

      if (error) throw new Error(error.message);

      // Best-effort bounded cleanup. Cache failures must never break an appraisal.
      const { error: cleanupError } = await admin
        .from("comparable_search_cache")
        .delete()
        .lt("expires_at", fetchedAt);
      if (cleanupError) {
        console.warn(
          `Unable to purge expired comparable cache entries: ${cleanupError.message}`,
        );
      }
    },
  };
}

export async function loadComparableSearchThroughCache({
  request,
  loader,
  store = databaseComparableSearchCacheStore(),
}: {
  request: ApifyComparableSearchRequest;
  loader: () => Promise<ApifyReaListingRecord[]>;
  store?: ComparableSearchCacheStore | null;
}): Promise<ApifyReaListingRecord[]> {
  if (!store) {
    return loader();
  }

  const cacheKey = buildComparableSearchCacheKey(request);
  try {
    const cached = await store.get(cacheKey);
    if (cached) return cached;
  } catch (error) {
    console.warn(
      `Unable to read comparable search cache; continuing with Apify: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  const existing = inFlightSearches.get(cacheKey);
  if (existing) return existing;

  const pending = (async () => {
    const records = await loader();
    if (records.length > 0) {
      try {
        await store.set(cacheKey, request, records);
      } catch (error) {
        console.warn(
          `Unable to write comparable search cache; returning Apify results: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
    return records;
  })();

  inFlightSearches.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    inFlightSearches.delete(cacheKey);
  }
}
