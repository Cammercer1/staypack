import "server-only";
import { z } from "zod";
import { calculatorPropertyReviewKey } from "./propertyReviewIdentity";
export { calculatorPropertyReviewKey } from "./propertyReviewIdentity";
import { marketForCountry } from "@/lib/property-market";
import { airroiInputSchema, type AirroiInput } from "@/lib/airroi/client";
import { fetchAirroiMarketOccupancy } from "@/lib/airroi/marketOccupancy";
import { fetchStrEstimate } from "@/lib/str/estimate";
import type { Listing, Report } from "@/lib/types";

/** Confirmation happens after property review. Reuse the original evidence only
 * for the same property and configuration, within its original 30-day lifetime. */
export async function estimateForCalculatorReview(input: AirroiInput, listing: Listing, report: Report, sourceKey: string) {
  const raw = z.object({ provider: z.literal("airroi"), input: airroiInputSchema, fetched_at: z.string() }).passthrough().safeParse(report.original_estimate_json?.raw);
  const age = raw.success ? Date.now() - Date.parse(raw.data.fetched_at) : Infinity;
  const saved = raw.success ? raw.data.input : null;
  const radians = Math.PI / 180;
  const distance = saved ? 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(
    Math.sin((saved.latitude - input.latitude) * radians / 2) ** 2 +
    Math.cos(saved.latitude * radians) * Math.cos(input.latitude * radians) * Math.sin((saved.longitude - input.longitude) * radians / 2) ** 2,
  ))) : Infinity;
  if (report.original_estimate_json && report.str_enrichment_json && saved &&
    sourceKey === calculatorPropertyReviewKey(listing) && age >= 0 && age < 30 * 86400000 && distance <= 50 &&
    saved.bedrooms === input.bedrooms && saved.bathrooms === input.bathrooms && saved.accommodates === input.accommodates &&
    saved.currency === marketForCountry(listing.country).currency) {
    const occupancy = await fetchAirroiMarketOccupancy({ ...saved, property_type: listing.property_type }, listing, report.str_enrichment_json.market_occupancy);
    return { estimate: report.original_estimate_json, reused: true,
      enrichment: { ...report.str_enrichment_json, market_occupancy: occupancy, cost_cents: occupancy.cost_cents, cache_status: "hit" as const } };
  }
  return { ...await fetchStrEstimate(input, listing, report.str_enrichment_json), reused: false };
}
