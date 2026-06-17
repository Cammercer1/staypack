import type { AirbticsTier, StrEstimate } from "@/lib/types";
import { isDevelopment } from "@/lib/env";
import {
  AIRBTICS_TIER_COST_CENTS,
  AIRBTICS_TIER_ENDPOINT,
  DEFAULT_AIRBTICS_TIER,
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
  report_type?: string;
  comps?: unknown[];
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

function isReportReady(message: AirbticsReportMessage, tier: AirbticsTier) {
  if (message.comps_status === "failed") {
    return "failed" as const;
  }

  const revenue = getReportRevenue(message);
  if (revenue == null) {
    return "pending" as const;
  }

  // Summary (/report/summary) returns headline KPIs with an empty comps_status.
  if (tier === "summary") {
    return "success" as const;
  }

  const compsStatus = message.comps_status;
  if (compsStatus === "fetching" || compsStatus === "pending") {
    return "pending" as const;
  }

  if (compsStatus === "success") {
    return "success" as const;
  }

  // Some /report/all responses include full comps+KPIs with empty comps_status.
  const hasFullPayload =
    message.report_type === "all" &&
    Array.isArray(message.comps) &&
    message.comps.length > 0 &&
    message.kpis != null &&
    typeof message.kpis === "object";
  if (hasFullPayload) {
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
  const maxAttempts = tier === "full" ? 20 : 10;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const message = await readAirbticsReport(reportId, apiKey, baseUrl);
    const status = isReportReady(message, tier);

    // #region agent log
    fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "a0cff1",
      },
      body: JSON.stringify({
        sessionId: "a0cff1",
        runId: "pre-fix",
        hypothesisId: "E",
        location: "lib/airbtics/client.ts:pollAirbticsReport",
        message: "Airbtics poll attempt",
        data: {
          reportId,
          tier,
          attempt,
          status,
          comps_status: message.comps_status ?? null,
          comps_len: Array.isArray(message.comps) ? message.comps.length : null,
          report_type: message.report_type ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (status === "failed") {
      throw new Error("Could not find enough comparable short-term rentals nearby");
    }

    if (status === "success") {
      // #region agent log
      fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "a0cff1",
        },
        body: JSON.stringify({
          sessionId: "a0cff1",
          runId: "pre-fix",
          hypothesisId: "E",
          location: "lib/airbtics/client.ts:pollAirbticsReport",
          message: "Airbtics poll success",
          data: {
            reportId,
            tier,
            attempt,
            comps_len: Array.isArray(message.comps) ? message.comps.length : null,
            comps_status: message.comps_status ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

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

function buildMockMonthlySeries(base: number) {
  return {
    "2025-07": Math.round(base * 0.82),
    "2025-08": Math.round(base * 0.78),
    "2025-09": Math.round(base * 0.86),
    "2025-10": Math.round(base * 0.94),
    "2025-11": Math.round(base * 1.02),
    "2025-12": Math.round(base * 1.18),
    "2026-01": Math.round(base * 1.22),
    "2026-02": Math.round(base * 1.1),
    "2026-03": Math.round(base * 1.04),
    "2026-04": Math.round(base * 0.98),
    "2026-05": Math.round(base * 0.9),
    "2026-06": Math.round(base * 0.86),
  };
}

function buildMockAirbticsRaw(
  input: AirbticsInput,
  tier: AirbticsTier,
): Record<string, unknown> {
  if (tier !== "full") {
    return { mock: true, tier, input };
  }

  return {
    mock: true,
    tier,
    input,
    report_type: "all",
    comps_status: "success",
    radius: 500,
    bedrooms: input.bedrooms,
    kpis: {
      "25": {
        ltm_revenue: 58000,
        ltm_nightly_rate: 245,
        ltm_occupancy_rate: 65,
        monthly_revenue: buildMockMonthlySeries(4833),
      },
      "50": {
        ltm_revenue: 72000,
        ltm_nightly_rate: 285,
        ltm_occupancy_rate: 69,
        monthly_revenue: buildMockMonthlySeries(6000),
        monthly_occupancy_rate: buildMockMonthlySeries(69),
        monthly_adr: buildMockMonthlySeries(285),
      },
      "75": {
        ltm_revenue: 86000,
        ltm_nightly_rate: 325,
        ltm_occupancy_rate: 73,
        monthly_revenue: buildMockMonthlySeries(7167),
      },
      "90": {
        ltm_revenue: 98000,
        ltm_nightly_rate: 365,
        ltm_occupancy_rate: 76,
      },
    },
    comps: [
      {
        listingID: "mock-comp-1",
        name: "Beachside family retreat",
        thumbnail_url: "",
        listing_url: "",
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        accommodates: input.accommodates,
        distance: 180,
        annual_revenue_ltm: 91000,
        avg_occupancy_rate_ltm: 74,
        avg_booked_daily_rate_ltm: 337,
        similarity_score: 0.94,
        similarity_score_meta: { revenue_score: 0.82 },
      },
      {
        listingID: "mock-comp-2",
        name: "Modern coastal stay",
        thumbnail_url: "",
        listing_url: "",
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        accommodates: input.accommodates,
        distance: 320,
        annual_revenue_ltm: 78000,
        avg_occupancy_rate_ltm: 70,
        avg_booked_daily_rate_ltm: 305,
        similarity_score: 0.9,
        similarity_score_meta: { revenue_score: 0.76 },
      },
      {
        listingID: "mock-comp-3",
        name: "Quiet suburb short stay",
        thumbnail_url: "",
        listing_url: "",
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        accommodates: input.accommodates,
        distance: 470,
        annual_revenue_ltm: 64000,
        avg_occupancy_rate_ltm: 66,
        avg_booked_daily_rate_ltm: 266,
        similarity_score: 0.86,
        similarity_score_meta: { revenue_score: 0.68 },
      },
    ],
  };
}

export async function fetchAirbticsEstimate(
  input: AirbticsInput,
  tier: AirbticsTier = DEFAULT_AIRBTICS_TIER,
): Promise<AirbticsEstimateResult> {
  if (isDevelopment() && !process.env.AIRBTICS_API_KEY) {
    const raw = buildMockAirbticsRaw(input, tier);
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
