import type { ApifyReaListingRecord } from "@/lib/apify/types";

const DEFAULT_API_HOST = "api.apify.com";
const DEFAULT_REA_ACTOR_ID = "qBUaDtdr6kYSBZE8J";
const DEFAULT_REA_MAX_LISTINGS = 50;
const DEFAULT_REA_TIMEOUT_MS = 120_000;

export function getApifyApiKey() {
  return process.env.APIFY_API_KEY?.trim() ?? "";
}

export function getApifyReaActorId() {
  return process.env.APIFY_REA_ACTOR_ID?.trim() || DEFAULT_REA_ACTOR_ID;
}

export function getApifyReaMaxListings() {
  const configured = Number(process.env.APIFY_REA_MAX_LISTINGS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(Math.round(configured), DEFAULT_REA_MAX_LISTINGS);
  }
  return DEFAULT_REA_MAX_LISTINGS;
}

function getApifyReaTimeoutMs() {
  const configured = Number(process.env.APIFY_REA_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_REA_TIMEOUT_MS;
}

export function hasApifyReaConfig() {
  return Boolean(getApifyApiKey());
}

export async function scrapeApifyReaListingUrl(
  listingUrl: string,
): Promise<ApifyReaListingRecord | null> {
  const records = await scrapeApifyReaRentSearch({
    searchUrl: listingUrl,
    maxItems: 1,
  });
  return records[0] ?? null;
}

export async function scrapeApifyReaRentSearch({
  searchUrl,
  maxItems,
}: {
  searchUrl: string;
  maxItems?: number;
}): Promise<ApifyReaListingRecord[]> {
  const apiKey = getApifyApiKey();
  if (!apiKey) {
    throw new Error("Apify is not configured");
  }

  const actorId = getApifyReaActorId();
  const timeoutMs = getApifyReaTimeoutMs();
  const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
  const limit = Math.min(maxItems ?? getApifyReaMaxListings(), DEFAULT_REA_MAX_LISTINGS);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs + 5_000);

  try {
    const response = await fetch(
      `https://${DEFAULT_API_HOST}/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(apiKey)}&timeout=${timeoutSec}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: [searchUrl],
          maxItems: limit,
          flattenOutput: true,
        }),
      },
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Apify REA scrape failed (${response.status}): ${text.slice(0, 240)}`,
      );
    }

    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Apify REA scrape returned an unexpected payload.");
    }

    return parsed as ApifyReaListingRecord[];
  } finally {
    clearTimeout(timeout);
  }
}
