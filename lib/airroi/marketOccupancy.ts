import { createHash } from "node:crypto";
import { z } from "zod";
import { airroiInputSchema, type AirroiInput } from "./client";
import type { Listing, StrMarketOccupancy } from "@/lib/types";

const marketSchema = z.object({
  country: z.string().min(1), region: z.string().min(1), locality: z.string().min(1),
  district: z.string().nullish(),
});
const fraction = z.number().min(0).max(1);
const pointSchema = z.object({
  date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/), avg: fraction,
  p25: fraction, p50: fraction, p75: fraction, p90: fraction,
}).refine((p) => p.p25 <= p.p50 && p.p50 <= p.p75 && p.p75 <= p.p90);
const STATES: Record<string, string> = {
  NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", SA: "South Australia",
  WA: "Western Australia", TAS: "Tasmania", ACT: "Australian Capital Territory", NT: "Northern Territory",
};
const clean = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

function listingType(value?: string | null) {
  if (/condo/i.test(value ?? "")) return "Entire condo";
  if (/apartment|unit|flat/i.test(value ?? "")) return "Entire rental unit";
  if (/townhouse/i.test(value ?? "")) return "Entire townhouse";
  if (/villa/i.test(value ?? "")) return "Entire villa";
  if (/house|home/i.test(value ?? "")) return "Entire home";
  return null;
}

/** Resolve suburb aliases to their enclosing city; never mix same-named suburbs across states. */
export function resolveOccupancyMarket(raw: unknown, suburb: string, region: string) {
  const entries = z.object({ entries: z.array(marketSchema) }).parse(raw).entries;
  const matches = entries.filter((m) => ["australia", "au"].includes(clean(m.country)) && clean(m.region) === clean(region));
  const districts = matches.filter((m) => clean(m.district) === clean(suburb));
  const candidates = districts.length ? districts : matches.filter((m) => clean(m.locality) === clean(suburb));
  const cities = [...new Set(candidates.map((m) => clean(m.locality)))];
  if (cities.length !== 1) throw new Error("The market location could not be resolved unambiguously.");
  const { country, region: matchedRegion, locality } = candidates[0];
  return { country, region: matchedRegion, locality };
}

export function normaliseMarketOccupancy(raw: unknown, expected: NonNullable<StrMarketOccupancy["market"]>, now = new Date()) {
  const payload = z.object({ market: marketSchema, results: z.array(z.unknown()) }).parse(raw);
  if (["country", "region", "locality", "district"].some((key) => clean(payload.market[key as keyof typeof payload.market]) !== clean(expected[key as keyof typeof expected]))) {
    throw new Error("The occupancy response returned a different market.");
  }
  const cutoff = now.toISOString().slice(0, 7);
  const byMonth = new Map<string, StrMarketOccupancy["months"][number]>();
  let invalidRows = 0;
  for (const candidate of payload.results) {
    const parsed = pointSchema.safeParse(candidate);
    if (!parsed.success) { invalidRows++; continue; }
    const p = parsed.data;
    const month = p.date.slice(0, 7);
    if (month >= cutoff) continue; // A partial current month is not comparable with completed months.
    if (byMonth.has(month)) throw new Error("Duplicate monthly occupancy records were returned.");
    byMonth.set(month, { month, average: p.avg * 100, p25: p.p25 * 100, p50: p.p50 * 100, p75: p.p75 * 100, p90: p.p90 * 100 });
  }
  const ordered = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  if (!ordered.length) throw new Error("No valid completed months of occupancy data were returned.");
  const latest = new Date(`${ordered.at(-1)!.month}-01T00:00:00Z`);
  const windowStart = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() - 11, 1)).toISOString().slice(0, 7);
  const months = ordered.filter((row) => row.month >= windowStart);
  if ((now.getUTCFullYear() - latest.getUTCFullYear()) * 12 + now.getUTCMonth() - latest.getUTCMonth() > 3) {
    throw new Error("The monthly occupancy data is too old to use as current market evidence.");
  }
  const warnings = ["The number of listings contributing to each month is not supplied."];
  if (invalidRows) warnings.push(`${invalidRows} invalid or non-monthly records were excluded.`);
  const start = new Date(`${months[0].month}-01T00:00:00Z`);
  const span = (latest.getUTCFullYear() - start.getUTCFullYear()) * 12 + latest.getUTCMonth() - start.getUTCMonth() + 1;
  if (months.length < 12 || span !== 12) warnings.push("A complete consecutive 12-month history is unavailable; missing months are not estimated.");
  return { months, warnings };
}

/** One market resolution plus one historical series. Missing history never blocks the calculator. */
export async function fetchAirroiMarketOccupancy(
  unparsedInput: AirroiInput,
  listing: Pick<Listing, "suburb" | "state" | "country">,
  previous?: StrMarketOccupancy,
): Promise<StrMarketOccupancy> {
  const input = airroiInputSchema.parse(unparsedInput);
  const region = STATES[listing.state?.toUpperCase() ?? ""] ?? listing.state ?? "";
  const type = listingType(input.property_type);
  const filters: StrMarketOccupancy["filters"] = { room_type: { eq: "entire_home" }, bedrooms: { eq: input.bedrooms } };
  if (type) filters.listing_type = { eq: type };
  const requestKey = createHash("sha256").update(JSON.stringify({ version: 1, lat: input.latitude, lng: input.longitude, suburb: listing.suburb, region, filters })).digest("hex");
  const now = new Date();
  // Reuse both history and confirmed insufficient-data results for a week.
  // Timeouts, credential errors and other transient failures remain retryable.
  const age = previous ? now.getTime() - Date.parse(previous.fetched_at) : Infinity;
  const reusable = previous?.status === "available" || (previous?.status === "unavailable" && previous.unavailable_reason === "insufficient_data");
  if (reusable && previous && previous.request_key === requestKey && age >= 0 && age < 7 * 86400000) {
    return { ...previous, cost_cents: 0 };
  }
  const result: StrMarketOccupancy = {
    status: "unavailable", market: null, label: "Market occupancy unavailable", filters,
    fetched_at: now.toISOString(), request_key: requestKey, cost_cents: 0, sample_count: null, months: [], warnings: [],
  };
  const key = process.env.AIRROI_API_KEY?.trim();
  if (!key) return { ...result, warnings: ["The market data service is not configured."] };
  try {
    const useSearch = Boolean(listing.suburb?.trim() && region && (!listing.country || ["au", "australia"].includes(clean(listing.country))));
    const url = new URL(`https://api.airroi.com/markets/${useSearch ? "search" : "lookup"}`);
    if (useSearch) url.searchParams.set("query", listing.suburb!.trim());
    else { url.searchParams.set("lat", String(input.latitude)); url.searchParams.set("lng", String(input.longitude)); }
    result.cost_cents += 1;
    const resolved = await fetch(url, { headers: { "X-API-KEY": key }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!resolved.ok) throw new Error(`Market resolution returned ${resolved.status}.`);
    const resolution: unknown = await resolved.json();
    const found = useSearch ? resolveOccupancyMarket(resolution, listing.suburb!, region) : marketSchema.parse(resolution);
    const market = { country: found.country, region: found.region, locality: found.locality };
    result.market = market;
    result.label = `${market.locality} · ${input.bedrooms}-bed ${type ? type.replace(/^Entire /, "") + "s" : "entire homes"}`;
    const request = { market, filter: filters, num_months: 13, currency: "native" };
    result.raw = { resolution, request };
    result.cost_cents += 10;
    const response = await fetch("https://api.airroi.com/markets/metrics/occupancy", {
      method: "POST", headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify(request), cache: "no-store", signal: AbortSignal.timeout(12000),
    });
    if (response.status === 404) result.unavailable_reason = "insufficient_data";
    if (!response.ok) throw new Error(response.status === 404
      ? "No occupancy history is available for this market and property type. The provider requires a sufficiently large matching market."
      : `Market occupancy returned ${response.status}.`);
    const raw: unknown = await response.json();
    const normalised = normaliseMarketOccupancy(raw, market, now);
    return { ...result, ...normalised, status: "available", raw: { resolution, request, response: raw } };
  } catch (error) {
    return { ...result, warnings: [error instanceof Error ? error.message : "Market occupancy data is unavailable."] };
  }
}
