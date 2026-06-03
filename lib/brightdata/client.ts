import { isDevelopment } from "@/lib/env";

const DEFAULT_API_HOST = "api.brightdata.com";
const DEFAULT_SCRAPE_TIMEOUT_MS = 25_000;
const DEFAULT_REA_SCRAPE_TIMEOUT_MS = 60_000;
const DEFAULT_REA_DISCOVER_TIMEOUT_MS = 180_000;
const REA_ABORT_RETRY_ATTEMPTS = 1;

export function getBrightDataApiKey() {
  return process.env.BRIGHTDATA_API_KEY?.trim() ?? "";
}

export function getBrightDataReaDatasetId() {
  return (
    process.env.BRIGHTDATA_REA_DATASET_ID?.trim() ?? "gd_l3cvjh111l943r4awk"
  );
}

export function getBrightDataUnlockerZone() {
  return process.env.BRIGHTDATA_UNLOCKER_ZONE?.trim() ?? "";
}

export function hasBrightDataReaConfig() {
  return Boolean(getBrightDataApiKey() && getBrightDataReaDatasetId());
}

export function hasBrightDataUnlockerConfig() {
  return Boolean(getBrightDataApiKey() && getBrightDataUnlockerZone());
}

function getScrapeTimeoutMs() {
  const configured = Number(process.env.BRIGHTDATA_SCRAPE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_SCRAPE_TIMEOUT_MS;
}

function getReaScrapeTimeoutMs() {
  const configured = Number(process.env.BRIGHTDATA_REA_SCRAPE_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  const shared = getScrapeTimeoutMs();
  return Math.max(shared, DEFAULT_REA_SCRAPE_TIMEOUT_MS);
}

function getReaDiscoverTimeoutMs() {
  const configured = Number(process.env.BRIGHTDATA_REA_DISCOVER_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return Math.max(getReaScrapeTimeoutMs(), DEFAULT_REA_DISCOVER_TIMEOUT_MS);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function brightDataFetch(
  path: string,
  options?: { method?: "GET" | "POST"; body?: Record<string, unknown>; timeoutMs?: number },
) {
  const apiKey = getBrightDataApiKey();
  if (!apiKey) {
    if (isDevelopment()) {
      return null;
    }
    throw new Error("Bright Data is not configured");
  }

  const method = options?.method ?? "POST";
  const timeoutMs = options?.timeoutMs ?? getScrapeTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://${DEFAULT_API_HOST}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify(options?.body ?? {}) : undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Bright Data request failed (${response.status}): ${text.slice(0, 240)}`,
      );
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function brightDataRequest(
  path: string,
  body: Record<string, unknown>,
  options?: { timeoutMs?: number },
) {
  return brightDataFetch(path, { method: "POST", body, timeoutMs: options?.timeoutMs });
}

function extractPendingSnapshotId(records: Record<string, unknown>[]) {
  for (const entry of records) {
    if (typeof entry.snapshot_id === "string" && !isReaDiscoverListingRecord(entry)) {
      return entry.snapshot_id;
    }
  }
  return null;
}

function isReaDiscoverListingRecord(entry: Record<string, unknown>) {
  if (entry.error) {
    return false;
  }
  if (entry.snapshot_id && !entry.street_address && entry.rent_price == null) {
    return false;
  }
  return (
    typeof entry.url === "string" ||
    typeof entry.street_address === "string" ||
    typeof entry.rent_price === "number"
  );
}

async function waitForBrightDataSnapshotReady(snapshotId: string, deadlineMs: number) {
  const started = Date.now();
  const pollMs = 8_000;

  while (Date.now() - started < deadlineMs) {
    const raw = await brightDataFetch(
      `/datasets/v3/progress/${encodeURIComponent(snapshotId)}`,
      { method: "GET", timeoutMs: 30_000 },
    );

    if (!raw) {
      throw new Error("Bright Data is not configured");
    }

    const progress = JSON.parse(raw) as { status?: string; snapshot_status?: string };
    const status = String(progress.status ?? progress.snapshot_status ?? "").toLowerCase();

    if (status === "ready" || status === "done" || status === "completed") {
      return;
    }

    if (status === "failed" || status === "error") {
      throw new Error(
        `Bright Data snapshot failed (${snapshotId}): ${raw.slice(0, 240)}`,
      );
    }

    await sleep(pollMs);
  }

  throw new Error(
    `Bright Data snapshot ${snapshotId} was not ready within ${Math.round(deadlineMs / 1000)}s`,
  );
}

async function downloadBrightDataSnapshot(snapshotId: string) {
  return brightDataFetch(
    `/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`,
    { method: "GET", timeoutMs: 120_000 },
  );
}

async function resolveBrightDataDiscoverRecords(
  initialRaw: string,
  deadlineMs: number,
): Promise<Record<string, unknown>[]> {
  let records = parseBrightDataPayload<Record<string, unknown>>(initialRaw);
  const snapshotId = extractPendingSnapshotId(records);

  if (!snapshotId) {
    return records;
  }

  await waitForBrightDataSnapshotReady(snapshotId, deadlineMs);
  const downloaded = await downloadBrightDataSnapshot(snapshotId);

  if (!downloaded?.trim()) {
    return [];
  }

  records = parseBrightDataPayload<Record<string, unknown>>(downloaded);
  return records;
}

function parseBrightDataPayload<T>(raw: string): T[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as T | T[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  }
}

export async function scrapeBrightDataReaListing(url: string) {
  const datasetId = getBrightDataReaDatasetId();
  const timeoutMs = getReaScrapeTimeoutMs();
  let raw: string | null = null;
  let attempt = 0;

  while (attempt <= REA_ABORT_RETRY_ATTEMPTS) {
    attempt += 1;
    try {
      raw = await brightDataRequest(
        `/datasets/v3/scrape?dataset_id=${encodeURIComponent(datasetId)}&notify=false&include_errors=true`,
        {
          input: [{ url }],
        },
        { timeoutMs },
      );
      break;
    } catch (error) {
      const isAbort =
        error instanceof Error &&
        /aborted|abort/i.test(error.message);
      if (!isAbort || attempt > REA_ABORT_RETRY_ATTEMPTS) {
        throw error;
      }
    }
  }

  if (!raw) {
    return null;
  }

  const records = parseBrightDataPayload<Record<string, unknown>>(raw);
  const record = records.find(
    (entry) =>
      !entry.error &&
      (typeof entry.url === "string" ||
        typeof entry.street_address === "string" ||
        typeof entry.description === "string"),
  );

  return (record ?? null) as import("@/lib/brightdata/types").BrightDataReaRecord | null;
}

export type ReaRentDiscoverInput = {
  searchUrl: string;
  limitPages?: number;
};

/** Crawl a REA rent search SERP and return listing records (`discover_new` mode). */
export async function scrapeBrightDataReaRentDiscover({
  searchUrl,
  limitPages = 1,
}: ReaRentDiscoverInput) {
  const datasetId = getBrightDataReaDatasetId();
  const timeoutMs = getReaDiscoverTimeoutMs();
  let raw: string | null = null;
  let attempt = 0;

  while (attempt <= REA_ABORT_RETRY_ATTEMPTS) {
    attempt += 1;
    try {
      raw = await brightDataRequest(
        `/datasets/v3/scrape?dataset_id=${encodeURIComponent(datasetId)}&notify=false&include_errors=true&type=discover_new&discover_by=url`,
        {
          input: [{ url: searchUrl, limit_pages: limitPages }],
        },
        { timeoutMs },
      );
      break;
    } catch (error) {
      const isAbort =
        error instanceof Error && /aborted|abort/i.test(error.message);
      if (!isAbort || attempt > REA_ABORT_RETRY_ATTEMPTS) {
        throw error;
      }
    }
  }

  if (!raw) {
    return [];
  }

  const records = await resolveBrightDataDiscoverRecords(raw, timeoutMs);
  return records.filter(isReaDiscoverListingRecord) as import("@/lib/brightdata/types").BrightDataReaRecord[];
}

/** Fetch raw HTML through Bright Data Web Unlocker (for REA search discovery). */
export async function fetchBrightDataHtml(url: string) {
  const zone = getBrightDataUnlockerZone();
  if (!zone) {
    return null;
  }

  const raw = await brightDataRequest(
    "/request",
    {
      zone,
      url,
      format: "raw",
    },
    { timeoutMs: getScrapeTimeoutMs() },
  );

  return raw ?? null;
}
