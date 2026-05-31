import { isDevelopment } from "@/lib/env";

const DEFAULT_API_HOST = "api.brightdata.com";
const DEFAULT_SCRAPE_TIMEOUT_MS = 25_000;

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

async function brightDataRequest(
  path: string,
  body: Record<string, unknown>,
  options?: { timeoutMs?: number },
) {
  const apiKey = getBrightDataApiKey();
  if (!apiKey) {
    if (isDevelopment()) {
      return null;
    }
    throw new Error("Bright Data is not configured");
  }

  const timeoutMs = options?.timeoutMs ?? getScrapeTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://${DEFAULT_API_HOST}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
  const raw = await brightDataRequest(
    `/datasets/v3/scrape?dataset_id=${encodeURIComponent(datasetId)}&notify=false&include_errors=true`,
    {
      input: [{ url }],
    },
  );

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
