import { createHash } from "node:crypto";
import { z } from "zod";
import { airroiInputSchema, type AirroiInput } from "./client";
import type { Listing, StrMarketOccupancy } from "@/lib/types";
import { withAirroiMarketCache } from "./marketOccupancyCache";

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
  if (/house|home|duplex|semi[- ]?detached|terrace/i.test(value ?? "")) return "Entire home";
  return null;
}

type MarketListing = Pick<Listing, "suburb" | "state" | "country">;
const countryName = (value: string | null | undefined) => ["au", "australia"].includes(clean(value)) ? "australia" : ["us", "usa", "united states", "united states of america"].includes(clean(value)) ? "united states" : clean(value);
const US_STATES: Record<string, string> = Object.fromEntries("AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming".split("|").map(pair => pair.split(":")));
const regionName = (value: string | null | undefined, country?: string | null) => clean((countryName(country) === "united states" ? US_STATES : STATES)[value?.trim().toUpperCase() ?? ""] ?? value);

/** The coordinate endpoint returns the nearest listing's market. Validate its
 * country/state and label its enclosing locality, without guessing from suburb text.
 */
export function resolveCoordinateOccupancyMarket(raw: unknown, listing: MarketListing) {
  const found = marketSchema.parse(raw);
  if ((listing.country && countryName(found.country) !== countryName(listing.country)) ||
      (listing.state && regionName(found.region, listing.country) !== regionName(listing.state, listing.country))) {
    throw new Error("The coordinate lookup returned a different country or state.");
  }
  return { country: found.country, region: found.region, locality: found.locality };
}

type SeriesAttempt = { request: unknown; response?: unknown; response_status?: number };
type Diagnostics = { resolution?: unknown; resolution_status?: number; request?: unknown; response?: unknown; response_status?: number; attempts?: SeriesAttempt[] };
class OccupancyDataError extends Error {
  constructor(message: string, readonly reason: NonNullable<StrMarketOccupancy["unavailable_reason"]>, readonly diagnostics: Diagnostics) {
    super(message);
  }
}

async function responseBody(response: Response, key: string): Promise<unknown> {
  // Preserve failed payloads too, but never retain a credential echoed by a service.
  const text = (await response.text()).replaceAll(key, "[redacted]");
  try { return JSON.parse(text); } catch { return text.slice(0, 2000); }
}

function occupancyPayload(raw: unknown, expected: NonNullable<StrMarketOccupancy["market"]>) {
  const payload = z.object({ market: marketSchema, results: z.array(z.unknown()) }).parse(raw);
  if (["country", "region", "locality", "district"].some((key) => clean(payload.market[key as keyof typeof payload.market]) !== clean(expected[key as keyof typeof expected]))) {
    throw new Error("The occupancy response returned a different market.");
  }
  return payload;
}

export function normaliseMarketOccupancy(raw: unknown, expected: NonNullable<StrMarketOccupancy["market"]>, now = new Date()) {
  const payload = occupancyPayload(raw, expected);
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

/** One coordinate resolution, then a typed series and at most one all-type
 * fallback on confirmed empty data. Shared cached
 * provider data is copied into each report's own immutable evidence snapshot.
 */
export async function fetchAirroiMarketOccupancy(
  unparsedInput: AirroiInput,
  listing: MarketListing,
  previous?: StrMarketOccupancy,
): Promise<StrMarketOccupancy> {
  const input = airroiInputSchema.parse(unparsedInput);
  const type = listingType(input.property_type);
  const filters: StrMarketOccupancy["filters"] = { room_type: { eq: "entire_home" }, bedrooms: { eq: input.bedrooms } };
  if (type) filters.listing_type = { eq: type };
  const locationKey = JSON.stringify({ lat: input.latitude, lng: input.longitude, country: countryName(listing.country), region: regionName(listing.state, listing.country) });
  const requestKey = createHash("sha256").update(JSON.stringify({ version: 3, locationKey, filters })).digest("hex");
  const now = new Date();
  const age = previous ? now.getTime() - Date.parse(previous.fetched_at) : Infinity;
  const reusable = previous?.status === "available" || (previous?.status === "unavailable" && previous.unavailable_reason === "insufficient_data");
  if (reusable && previous && previous.request_key === requestKey && age >= 0 && age < 7 * 86400000 && previous.fetched_at.slice(0, 7) === now.toISOString().slice(0, 7)) {
    return { ...previous, cost_cents: 0 };
  }
  const result: StrMarketOccupancy = {
    status: "unavailable", market: null, label: "Annual revenue benchmarks", filters, benchmark_scope: type ? "property_type" : "all_property_types",
    fetched_at: now.toISOString(), request_key: requestKey, cost_cents: 0, sample_count: null, months: [], warnings: [],
  };
  const key = process.env.AIRROI_API_KEY?.trim();
  if (!key) return { ...result, unavailable_reason: "not_configured", warnings: ["The market data service is not configured."] };
  const diagnostics: Diagnostics = {};
  let stage: "resolution" | "history" = "resolution";
  try {
    const resolution = await withAirroiMarketCache(`location:${locationKey}`, async () => {
      const url = new URL("https://api.airroi.com/markets/lookup");
      url.searchParams.set("lat", String(input.latitude));
      url.searchParams.set("lng", String(input.longitude));
      result.cost_cents += 1;
      const response = await fetch(url, { headers: { "X-API-KEY": key }, cache: "no-store", signal: AbortSignal.timeout(8000) });
      const body = await responseBody(response, key);
      const raw = { resolution: body, resolution_status: response.status };
      if (!response.ok) throw new OccupancyDataError(`Market coordinate lookup returned ${response.status}.`, "market_resolution_failed", raw);
      try { return { market: resolveCoordinateOccupancyMarket(body, listing), raw }; }
      catch (error) { throw new OccupancyDataError(error instanceof Error ? error.message : "Invalid coordinate market.", "market_resolution_failed", raw); }
    }, now);
    Object.assign(diagnostics, resolution.raw);
    const market = resolution.market;
    result.market = market;
    result.label = `${market.locality} · ${input.bedrooms}-bed ${type ? type.replace(/^Entire /, "") + "s" : "entire homes"}`;
    stage = "history";
    async function getSeries(seriesFilters: StrMarketOccupancy["filters"]) {
      const request = { market, filter: seriesFilters, num_months: 13, currency: "native" };
      diagnostics.request = request;
      const seriesKey = JSON.stringify({ market: Object.fromEntries(Object.entries(market).map(([name, value]) => [name, clean(value)])), filters: seriesFilters, num_months: 13 });
      try {
        const series = await withAirroiMarketCache(`occupancy:${seriesKey}`, async () => {
          result.cost_cents += 10;
          const response = await fetch("https://api.airroi.com/markets/metrics/occupancy", {
            method: "POST", headers: { "X-API-KEY": key!, "Content-Type": "application/json" },
            body: JSON.stringify(request), cache: "no-store", signal: AbortSignal.timeout(12000),
          });
          const body = await responseBody(response, key!);
          const raw = { response: body, response_status: response.status };
          if (response.status === 404) return { status: "unavailable" as const, fetched_at: now.toISOString(), raw };
          if (!response.ok) throw new OccupancyDataError(`Market occupancy returned ${response.status}.`, "request_failed", raw);
          try {
            // An explicitly empty, valid market response can broaden; corrupt or
            // mismatched data cannot trigger another paid request.
            if (!occupancyPayload(body, market).results.length) return { status: "unavailable" as const, fetched_at: now.toISOString(), raw };
            normaliseMarketOccupancy(body, market, now);
          } catch (error) { throw new OccupancyDataError(error instanceof Error ? error.message : "Invalid occupancy history.", "invalid_data", raw); }
          return { status: "available" as const, fetched_at: now.toISOString(), raw };
        }, now);
        (diagnostics.attempts ??= []).push({ request, ...series.raw });
        Object.assign(diagnostics, series.raw);
        return series;
      } catch (error) {
        (diagnostics.attempts ??= []).push({ request, ...(error instanceof OccupancyDataError ? error.diagnostics : {}) });
        throw error;
      }
    }
    let series = await getSeries(filters);
    if (series.status === "unavailable" && type) {
      // One broader cohort, never a paid loop through individual property types.
      result.filters = { room_type: { eq: "entire_home" }, bedrooms: { eq: input.bedrooms } };
      result.benchmark_scope = "all_property_types";
      series = await getSeries(result.filters);
    }
    if (result.benchmark_scope === "all_property_types") result.label = `${market.locality} · ${input.bedrooms}-bed entire homes · all property types`;
    // Keep the provider fetch date on cache hits; do not extend the history's lifetime.
    result.fetched_at = series.fetched_at;
    if (series.status === "unavailable") return { ...result, unavailable_reason: "insufficient_data", raw: diagnostics,
      warnings: ["The provider returned no occupancy history for this market and bedroom count. Annual revenue benchmarks are included instead."] };
    const normalised = normaliseMarketOccupancy(series.raw.response, market, now);
    if (result.benchmark_scope === "all_property_types") normalised.warnings.push("The occupancy benchmark includes all property types with the same bedroom count and entire-home stays. It does not change the property revenue estimate or selected comparables.");
    return { ...result, ...normalised, status: "available", raw: diagnostics };
  } catch (error) {
    if (error instanceof OccupancyDataError) Object.assign(diagnostics, error.diagnostics);
    return { ...result, raw: diagnostics,
      unavailable_reason: error instanceof OccupancyDataError ? error.reason : stage === "resolution" ? "market_resolution_failed" : "request_failed",
      warnings: [error instanceof Error ? error.message : "Market occupancy could not be retrieved."] };
  }
}
