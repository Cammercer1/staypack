import type { AirbticsTier, StrEstimate } from "@/lib/types";
import { isDevelopment } from "@/lib/env";
import {
  AIRBTICS_TIER_COST_CENTS,
  AIRBTICS_TIER_ENDPOINT,
} from "@/lib/airbtics/constants";
import { buildStrEnrichment } from "@/lib/airbtics/enrich";

const DEFAULT_AIRBTICS_BASE_URL =
  "https://crap0y5bx5.execute-api.us-east-2.amazonaws.com/prod";

export type AirbticsInput = {
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
};

export type AirbticsEstimateResult = {
  estimate: StrEstimate;
  tier: AirbticsTier;
  reportId: string;
  costCents: number;
  enrichment: ReturnType<typeof buildStrEnrichment>;
};

type AirbticsReportMessage = Record<string, unknown> & {
  id?: string;
  report_id?: string;
  comps_status?: string;
  revenue?: number;
  occupancy_rate?: number;
  nightly_rate?: number;
  radius?: number;
  kpis?: Record<string, Record<string, unknown>>;
};

function getAirbticsBaseUrl() {
  return (
    process.env.AIRBTICS_BASE_URL?.replace(/\/$/, "") || DEFAULT_AIRBTICS_BASE_URL
  );
}

function getAirbticsApiKey() {
  const apiKey = process.env.AIRBTICS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("STR estimate service is not configured");
  }

  return apiKey;
}

function buildHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
}

async function airbticsFetch(url: string, init: RequestInit, label: string) {
  try {
    return await fetch(url, { ...init, cache: "no-store" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network error";
    throw new Error(`STR estimate ${label} failed: ${reason}`);
  }
}

function unwrapMessage(payload: Record<string, unknown>): AirbticsReportMessage {
  if (payload.message && typeof payload.message === "object") {
    return payload.message as AirbticsReportMessage;
  }

  return payload as AirbticsReportMessage;
}

async function createAirbticsReport(
  input: AirbticsInput,
  tier: AirbticsTier,
  apiKey: string,
  baseUrl: string,
) {
  const response = await airbticsFetch(
    `${baseUrl}${AIRBTICS_TIER_ENDPOINT[tier]}`,
    {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        latitude: input.latitude,
        longitude: input.longitude,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        accommodates: input.accommodates,
      }),
    },
    `${tier} request`,
  );

  const rawText = await response.text();
  let payload: Record<string, unknown>;

  try {
    payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(rawText || `STR estimate request failed (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(
      String(payload.message ?? payload.error ?? rawText) ||
        `STR estimate request failed (${response.status})`,
    );
  }

  const message = unwrapMessage(payload);
  const reportId = String(message.report_id ?? message.id ?? "");

  if (!reportId) {
    throw new Error("STR estimate did not return a report id");
  }

  return reportId;
}

async function readAirbticsReport(
  reportId: string,
  apiKey: string,
  baseUrl: string,
) {
  const response = await airbticsFetch(
    `${baseUrl}/report?id=${encodeURIComponent(reportId)}`,
    {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    },
    "report lookup",
  );

  const rawText = await response.text();
  let payload: Record<string, unknown>;

  try {
    payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(rawText || `STR estimate lookup failed (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(
      String(payload.message ?? payload.error ?? rawText) ||
        `STR estimate lookup failed (${response.status})`,
    );
  }

  return unwrapMessage(payload);
}

function getReportRevenue(message: AirbticsReportMessage) {
  if (message.revenue != null && Number.isFinite(Number(message.revenue))) {
    return Number(message.revenue);
  }

  const edited = message.kpis?.edited ?? message.kpis?.["50"];
  const revenue = edited?.ltm_revenue;

  if (revenue != null && Number.isFinite(Number(revenue))) {
    return Number(revenue);
  }

  return null;
}

function isReportReady(message: AirbticsReportMessage) {
  if (message.comps_status === "failed") {
    return "failed" as const;
  }

  if (message.comps_status === "success" && getReportRevenue(message) != null) {
    return "success" as const;
  }

  return "pending" as const;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getPollDelayMs(attempt: number) {
  if (attempt < 2) return 600;
  if (attempt < 5) return 1000;
  return 1500;
}

async function pollAirbticsReport(
  reportId: string,
  apiKey: string,
  baseUrl: string,
  tier: AirbticsTier,
) {
  const maxAttempts = tier === "full" ? 14 : 10;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const message = await readAirbticsReport(reportId, apiKey, baseUrl);
    const status = isReportReady(message);

    if (status === "failed") {
      throw new Error("Could not find enough comparable short-term rentals nearby");
    }

    if (status === "success") {
      return {
        reportId,
        message,
      };
    }

    if (attempt < maxAttempts - 1) {
      await wait(getPollDelayMs(attempt));
    }
  }

  throw new Error("STR estimate is still processing. Try again in a moment.");
}

export async function fetchAirbticsEstimate(
  input: AirbticsInput,
  tier: AirbticsTier = "summary",
): Promise<AirbticsEstimateResult> {
  if (isDevelopment() && !process.env.AIRBTICS_API_KEY) {
    const raw = { mock: true, tier, input };
    const estimate = {
      annualRevenue: 72000,
      monthlyRevenue: 6000,
      weeklyRevenue: 1385,
      nightlyRate: 285,
      occupancyRate: 69,
      bookedNights: 252,
      radiusM: 500,
      raw,
    };

    return {
      estimate,
      tier,
      reportId: "mock-report-id",
      costCents: AIRBTICS_TIER_COST_CENTS[tier],
      enrichment: tier === "full" ? buildStrEnrichment(raw) : null,
    };
  }

  const apiKey = getAirbticsApiKey();
  const baseUrl = getAirbticsBaseUrl();
  const reportId = await createAirbticsReport(input, tier, apiKey, baseUrl);
  const { message } = await pollAirbticsReport(reportId, apiKey, baseUrl, tier);
  const raw = {
    report_id: reportId,
    tier,
    ...message,
  };

  return {
    estimate: normaliseAirbticsResponse(raw),
    tier,
    reportId,
    costCents: AIRBTICS_TIER_COST_CENTS[tier],
    enrichment: tier === "full" ? buildStrEnrichment(raw) : null,
  };
}

export function normaliseAirbticsResponse(raw: Record<string, unknown>): StrEstimate {
  const source =
    raw.message && typeof raw.message === "object"
      ? (raw.message as Record<string, unknown>)
      : raw.data && typeof raw.data === "object"
        ? (raw.data as Record<string, unknown>)
        : raw.summary && typeof raw.summary === "object"
          ? (raw.summary as Record<string, unknown>)
          : raw;

  const kpiSource =
    (source.kpis as Record<string, Record<string, unknown>> | undefined)?.edited ??
    (source.kpis as Record<string, Record<string, unknown>> | undefined)?.["50"];

  const annualRevenue = numberOrNull(
    kpiSource?.ltm_revenue ??
      source.revenue ??
      source.annual_revenue ??
      source.annualRevenue ??
      source.estimated_annual_revenue,
  );
  const monthlyRevenue =
    numberOrNull(source.monthly_revenue ?? source.monthlyRevenue) ??
    (annualRevenue != null ? Math.round(annualRevenue / 12) : null);
  const weeklyRevenue =
    numberOrNull(source.weekly_revenue ?? source.weeklyRevenue) ??
    (annualRevenue != null ? Math.round(annualRevenue / 52) : null);
  const nightlyRate = numberOrNull(
    kpiSource?.ltm_nightly_rate ??
      source.nightly_rate ??
      source.nightlyRate ??
      source.average_nightly_rate,
  );
  const occupancyRate = numberOrNull(
    kpiSource?.ltm_occupancy_rate ??
      source.occupancy_rate ??
      source.occupancyRate ??
      source.occupancy,
  );
  const bookedNights =
    numberOrNull(source.booked_nights ?? source.bookedNights) ??
    (occupancyRate != null ? Math.round((occupancyRate / 100) * 365) : null);
  const radiusM = numberOrNull(
    source.radius ??
      source.radius_m ??
      source.radiusM ??
      source.search_radius_m,
  );

  return {
    annualRevenue,
    monthlyRevenue,
    weeklyRevenue,
    nightlyRate,
    occupancyRate,
    bookedNights,
    radiusM,
    raw,
  };
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
