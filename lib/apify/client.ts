import type { ApifyReaListingRecord } from "@/lib/apify/types";

const DEFAULT_API_HOST = "api.apify.com";
const DEFAULT_REA_ACTOR_ID = "qBUaDtdr6kYSBZE8J";
const DEFAULT_REA_MAX_LISTINGS = 50;
const DEFAULT_REA_TIMEOUT_MS = 240_000;
const DEFAULT_REA_MAX_REQUEST_RETRIES = 2;
const DEFAULT_REA_MAX_CONCURRENCY = 10;

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
  const records = await scrapeApifyReaListingUrls([listingUrl]);
  return records[0] ?? null;
}

export async function scrapeApifyReaListingUrls(
  listingUrls: string[],
): Promise<ApifyReaListingRecord[]> {
  return scrapeApifyReaUrls({
    startUrls: listingUrls,
    maxItems: listingUrls.length,
    includeDetails: true,
  });
}

export async function scrapeApifyReaRentSearch({
  searchUrl,
  maxItems,
}: {
  searchUrl: string;
  maxItems?: number;
}): Promise<ApifyReaListingRecord[]> {
  return scrapeApifyReaRentSearchUrls({
    searchUrls: [searchUrl],
    maxItems,
  });
}

export async function scrapeApifyReaRentSearchUrls({
  searchUrls,
  maxItems,
}: {
  searchUrls: string[];
  maxItems?: number;
}): Promise<ApifyReaListingRecord[]> {
  return scrapeApifyReaUrls({
    startUrls: searchUrls,
    maxItems,
  });
}

async function scrapeApifyReaUrls({
  startUrls,
  maxItems,
  includeDetails = false,
}: {
  startUrls: string[];
  maxItems?: number;
  includeDetails?: boolean;
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
  const timeout = setTimeout(() => controller.abort(), timeoutMs + 15_000);
  let runId: string | null = null;

  try {
    const startResponse = await fetch(
      `https://${DEFAULT_API_HOST}/v2/acts/${actorId}/runs?token=${encodeURIComponent(apiKey)}&timeout=${timeoutSec}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls,
          maxItems: limit,
          flattenOutput: true,
          includeSurroundingSuburbs: false,
          minConcurrency: 1,
          maxConcurrency: DEFAULT_REA_MAX_CONCURRENCY,
          maxRequestRetries: DEFAULT_REA_MAX_REQUEST_RETRIES,
          ...(includeDetails ? { includeDetails: true } : {}),
        }),
      },
    );
    const startText = await startResponse.text();
    if (!startResponse.ok) {
      throw new Error(
        `Unable to start Apify REA scrape (${startResponse.status}): ${startText.slice(0, 240)}`,
      );
    }

    const started = JSON.parse(startText) as {
      data?: { id?: string; defaultDatasetId?: string; status?: string };
    };
    runId = started.data?.id ?? null;
    if (!runId) {
      throw new Error("Apify REA scrape did not return a run ID.");
    }

    const deadline = Date.now() + timeoutMs;
    let datasetId = started.data?.defaultDatasetId;

    while (Date.now() < deadline) {
      const runResponse = await fetch(
        `https://${DEFAULT_API_HOST}/v2/actor-runs/${runId}?token=${encodeURIComponent(apiKey)}`,
        { signal: controller.signal },
      );
      const runText = await runResponse.text();
      if (!runResponse.ok) {
        throw new Error(
          `Unable to check Apify REA scrape (${runResponse.status}): ${runText.slice(0, 240)}`,
        );
      }

      const runPayload = JSON.parse(runText) as {
        data?: {
          status?: string;
          statusMessage?: string;
          defaultDatasetId?: string;
        };
      };
      const status = runPayload.data?.status;
      datasetId = runPayload.data?.defaultDatasetId ?? datasetId;

      if (status === "SUCCEEDED") {
        if (!datasetId) {
          throw new Error("Apify REA scrape completed without a dataset ID.");
        }

        const datasetResponse = await fetch(
          `https://${DEFAULT_API_HOST}/v2/datasets/${datasetId}/items?token=${encodeURIComponent(apiKey)}&clean=true&format=json&limit=${limit}`,
          { signal: controller.signal },
        );
        const datasetText = await datasetResponse.text();
        if (!datasetResponse.ok) {
          throw new Error(
            `Unable to read Apify REA results (${datasetResponse.status}): ${datasetText.slice(0, 240)}`,
          );
        }

        const parsed = JSON.parse(datasetText) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error("Apify REA scrape returned an unexpected payload.");
        }
        return parsed as ApifyReaListingRecord[];
      }

      if (
        status === "FAILED" ||
        status === "ABORTED" ||
        status === "TIMED-OUT"
      ) {
        const detail = runPayload.data?.statusMessage?.trim();
        throw new Error(
          `Apify REA scrape ${status.toLowerCase()}${detail ? `: ${detail}` : ""}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }

    throw new Error(`Apify REA scrape timed out after ${timeoutSec} seconds.`);
  } finally {
    clearTimeout(timeout);
    if (controller.signal.aborted && runId) {
      await fetch(
        `https://${DEFAULT_API_HOST}/v2/actor-runs/${runId}/abort?token=${encodeURIComponent(apiKey)}`,
        { method: "POST" },
      ).catch(() => undefined);
    }
  }
}
