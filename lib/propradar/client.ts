import type { PropRadarSuburbResponse } from "@/lib/propradar/types";

const API_BASE = "https://api.propradar.com.au";

export function getPropRadarApiKey() {
  return process.env.PROP_RADAR_API_KEY?.trim() ?? "";
}

export function hasPropRadarConfig() {
  return Boolean(getPropRadarApiKey());
}

export type FetchPropRadarSuburbInput = {
  suburb: string;
  state: string;
  postcode?: string | null;
};

export async function fetchPropRadarSuburbStats({
  suburb,
  state,
  postcode,
}: FetchPropRadarSuburbInput): Promise<PropRadarSuburbResponse> {
  const apiKey = getPropRadarApiKey();
  if (!apiKey) {
    throw new Error("PropRadar is not configured (PROP_RADAR_API_KEY)");
  }

  const stateCode = state.trim().toUpperCase();
  const suburbSegment = encodeURIComponent(suburb.trim());
  const params = new URLSearchParams();
  if (postcode?.trim()) {
    params.set("postcode", postcode.trim());
  }

  const query = params.toString();
  const url = `${API_BASE}/v1/suburbs/${stateCode}/${suburbSegment}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    headers: {
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `PropRadar suburb request failed (${response.status}): ${text.slice(0, 240)}`,
    );
  }

  return JSON.parse(text) as PropRadarSuburbResponse;
}
