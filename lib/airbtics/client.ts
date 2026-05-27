import type { StrEstimate } from "@/lib/types";
import { isDevelopment } from "@/lib/env";

const DEFAULT_AIRBTICS_BASE_URL =
  "https://crap0y5bx5.execute-api.us-east-2.amazonaws.com/prod";

export type AirbticsInput = {
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
};

type AirbticsReportMessage = Record<string, unknown> & {
  id?: string;
  report_id?: string;
  comps_status?: string;
  revenue?: number;
  occupancy_rate?: number;
  nightly_rate?: number;
  radius?: number;
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

async function createAirbticsSummaryReport(
  input: AirbticsInput,
  apiKey: string,
  baseUrl: string,
) {
  const response = await airbticsFetch(
    `${baseUrl}/report/summary`,
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
    "summary request",
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

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollAirbticsReport(
  reportId: string,
  apiKey: string,
  baseUrl: string,
) {
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const message = await readAirbticsReport(reportId, apiKey, baseUrl);

    if (message.comps_status === "failed") {
      throw new Error("Could not find enough comparable short-term rentals nearby");
    }

    if (
      message.comps_status === "success" &&
      message.revenue != null &&
      Number.isFinite(Number(message.revenue))
    ) {
      return {
        reportId,
        message,
      };
    }

    if (attempt < maxAttempts - 1) {
      await wait(1500);
    }
  }

  throw new Error("STR estimate is still processing. Try again in a moment.");
}

export async function fetchAirbticsEstimate(input: AirbticsInput): Promise<StrEstimate> {
  if (isDevelopment() && !process.env.AIRBTICS_API_KEY) {
    return {
      annualRevenue: 72000,
      monthlyRevenue: 6000,
      weeklyRevenue: 1385,
      nightlyRate: 285,
      occupancyRate: 69,
      bookedNights: 252,
      radiusM: 500,
      raw: { mock: true, input },
    };
  }

  const apiKey = getAirbticsApiKey();
  const baseUrl = getAirbticsBaseUrl();
  const reportId = await createAirbticsSummaryReport(input, apiKey, baseUrl);
  const { message } = await pollAirbticsReport(reportId, apiKey, baseUrl);

  return normaliseAirbticsResponse({
    report_id: reportId,
    ...message,
  });
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

  const annualRevenue = numberOrNull(
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
    source.nightly_rate ?? source.nightlyRate ?? source.average_nightly_rate,
  );
  const occupancyRate = numberOrNull(
    source.occupancy_rate ?? source.occupancyRate ?? source.occupancy,
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
