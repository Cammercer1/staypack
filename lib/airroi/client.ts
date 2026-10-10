import { z } from "zod";
import { reconcileStrEstimate } from "@/lib/reports/strEstimateAdjustments";
import type { StrCompCard, StrEnrichmentJson, StrEstimate } from "@/lib/types";
import { rankStrComps } from "@/lib/str/comparables";

export const airroiInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().min(0.5).max(20),
  accommodates: z.number().int().min(1).max(30),
  radiusM: z.number().min(1609.344).max(16093.44).default(2000),
  property_type: z.string().nullable().optional(),
  suburb: z.string().nullable().optional(),
});
export type AirroiInput = z.input<typeof airroiInputSchema>;
const curve = z.object({ p25: z.number().nonnegative(), p50: z.number().nonnegative(), p75: z.number().nonnegative(), p90: z.number().nonnegative() })
  .refine((p) => p.p25 <= p.p50 && p.p50 <= p.p75 && p.p75 <= p.p90, "Invalid percentile order");
const payloadSchema = z.object({
  currency: z.literal("AUD"),
  revenue: z.number().positive(),
  occupancy: z.number().positive().max(1),
  average_daily_rate: z.number().positive(),
  percentiles: z.object({ revenue: curve, occupancy: curve, average_daily_rate: curve }),
  monthly_revenue_distributions: z.array(z.number().min(0).max(1)).length(12)
    .refine((v) => Math.abs(v.reduce((a, b) => a + b, 0) - 1) < 0.01, "Invalid seasonal weights"),
  comparable_listings: z.array(z.unknown()),
});
const optionalNumber = z.number().finite().nullable().optional();
const compSchema = z.object({
  listing_info: z.object({ listing_id: z.string().regex(/^\d+$/), listing_name: z.string(), listing_type: z.string().nullish(), room_type: z.string(), cover_photo_url: z.string().nullish(), photo_urls: z.array(z.string()).nullish(), guest_favorite: z.boolean().nullish() }),
  location_info: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), locality: z.string().nullish(), district: z.string().nullish() }),
  property_details: z.object({ bedrooms: optionalNumber, baths: optionalNumber, guests: optionalNumber, amenities: z.array(z.string()).nullish() }),
  host_info: z.object({ superhost: z.boolean().nullish(), professional_management: z.boolean().nullish() }).nullish(),
  booking_settings: z.object({ min_nights: optionalNumber }).nullish(),
  ratings: z.object({ num_reviews: optionalNumber, rating_overall: optionalNumber }).optional(),
  performance_metrics: z.object({ ttm_revenue: z.number().nonnegative(), ttm_occupancy: z.number().min(0).max(1), ttm_avg_rate: optionalNumber, ttm_blocked_days: optionalNumber, ttm_days_reserved: optionalNumber, ttm_avg_length_of_stay: optionalNumber, l90d_occupancy: z.number().min(0).max(1).nullish(), l90d_revenue: optionalNumber }),
});

/** Node 24 exposes the original numeric token before IEEE-754 rounding. */
export function parseAirroiJson(text: string): unknown {
  return JSON.parse(text, (key, value, context?: { source: string }) => {
    if (typeof value === "number" && (key.endsWith("_id") || !Number.isSafeInteger(value) && Number.isInteger(value))) {
      if (!context?.source && !Number.isSafeInteger(value)) throw new Error("Cannot safely decode STR listing IDs");
      return context?.source ?? String(value);
    }
    return value;
  });
}

function distanceM(lat: number, lng: number, otherLat: number, otherLng: number) {
  const rad = (n: number) => n * Math.PI / 180;
  const a = Math.sin(rad(otherLat - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(otherLat)) * Math.sin(rad(otherLng - lng) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))));
}

export function normaliseAirroiResponse(raw: unknown, unparsedInput: AirroiInput) {
  const input = airroiInputSchema.parse(unparsedInput);
  const payload = payloadSchema.parse(raw);
  const revenue = Math.round(payload.revenue);
  const occupancy = payload.occupancy;
  if (revenue <= 0 || occupancy <= 0 || payload.percentiles.occupancy.p90 > 1) throw new Error("STR estimate contains invalid revenue or occupancy");
  const cards: StrCompCard[] = [];
  for (const candidate of payload.comparable_listings) {
    const result = compSchema.safeParse(candidate);
    if (!result.success) continue;
    const c = result.data;
    const distance = distanceM(input.latitude, input.longitude, c.location_info.latitude, c.location_info.longitude);
    if (distance > input.radiusM + 100 || c.listing_info.room_type !== "entire_home") continue;
    if (cards.some((card) => card.listing_id === c.listing_info.listing_id)) continue;
    cards.push({
      listing_id: c.listing_info.listing_id, name: c.listing_info.listing_name,
      thumbnail_url: c.listing_info.cover_photo_url ?? "", listing_url: `https://www.airbnb.com/rooms/${c.listing_info.listing_id}`,
      bedrooms: c.property_details.bedrooms ?? null, bathrooms: c.property_details.baths ?? null, accommodates: c.property_details.guests ?? null,
      distance_m: distance, annual_revenue: c.performance_metrics.ttm_revenue,
      occupancy_rate: c.performance_metrics.ttm_occupancy * 100, nightly_rate: c.performance_metrics.ttm_avg_rate ?? null,
      property_type: c.listing_info.listing_type, room_type: c.listing_info.room_type,
      suburb: c.location_info.district || c.location_info.locality,
      photo_urls: c.listing_info.photo_urls ?? [], reviews: c.ratings?.num_reviews ?? null, rating: c.ratings?.rating_overall ?? null,
      blocked_nights: c.performance_metrics.ttm_blocked_days ?? null, reserved_nights: c.performance_metrics.ttm_days_reserved ?? null,
      amenities: c.property_details.amenities ?? [], minimum_nights: c.booking_settings?.min_nights ?? null,
      average_length_of_stay: c.performance_metrics.ttm_avg_length_of_stay ?? null,
      recent_occupancy_rate: c.performance_metrics.l90d_occupancy == null ? null : c.performance_metrics.l90d_occupancy * 100,
      recent_revenue: c.performance_metrics.l90d_revenue ?? null,
      superhost: c.host_info?.superhost ?? null, professional_management: c.host_info?.professional_management ?? null,
      guest_favorite: c.listing_info.guest_favorite ?? null,
    });
  }
  const pool = rankStrComps(cards, input);
  const estimate: StrEstimate = reconcileStrEstimate({
    annualRevenue: revenue, monthlyRevenue: Math.round(revenue / 12), weeklyRevenue: Math.round(revenue / 52),
    nightlyRate: payload.average_daily_rate, occupancyRate: occupancy * 100,
    bookedNights: Math.round(occupancy * 365), radiusM: input.radiusM,
    raw: { provider: "airroi", input, response: raw },
  });
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const enrichment: StrEnrichmentJson = {
    provider: "airroi", tier: "full", currency: "AUD", estimate_basis: "provider", seasonality_basis: "modelled",
    comp_count: pool.length, radius_m: input.radiusM, revenue_range: payload.percentiles.revenue,
    occupancy_range: Object.fromEntries(Object.entries(payload.percentiles.occupancy).map(([key, value]) => [key, value * 100])) as NonNullable<StrEnrichmentJson["occupancy_range"]>,
    nightly_rate_range: payload.percentiles.average_daily_rate,
    comp_pool: pool, comps: pool.slice(0, 6), selected_comp_ids: pool.slice(0, 6).map((c) => c.listing_id),
    seasonality: payload.monthly_revenue_distributions.map((weight, index) => ({ month: months[index], revenue: revenue * weight, revenue_low: null, revenue_high: null, occupancy: null, adr: null, modelled: true })),
  };
  return { estimate, enrichment };
}

export async function fetchAirroiEstimate(unparsedInput: AirroiInput) {
  const input = airroiInputSchema.parse(unparsedInput);
  const key = process.env.AIRROI_API_KEY?.trim();
  if (!key) throw new Error("STR estimates are not configured. Add AIRROI_API_KEY to the server environment.");
  const url = new URL("https://api.airroi.com/calculator/estimate");
  for (const [name, value] of Object.entries({ lat: input.latitude, lng: input.longitude, bedrooms: input.bedrooms, baths: input.bathrooms, guests: input.accommodates, radius: input.radiusM / 1609.344, room_type: "entire_home", currency: "native" })) url.searchParams.set(name, String(value));
  const response = await fetch(url, { headers: { "X-API-KEY": key }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 403 ? "STR data service rejected the request. Check the API key and credit balance." : `STR data service returned ${response.status}. Try again later.`);
  const raw = parseAirroiJson(await response.text());
  const result = normaliseAirroiResponse(raw, input);
  result.enrichment.fetched_at = new Date().toISOString();
  result.enrichment.cost_cents = 20;
  result.enrichment.request_id = response.headers.get("x-request-id");
  return result;
}
