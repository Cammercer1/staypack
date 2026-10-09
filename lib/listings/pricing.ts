import { z } from "zod";
import { extractPropertyPriceAmounts, normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import type { Listing } from "@/lib/types";

export type PricePurpose = "sale" | "lease";
const amount = z.number().finite().positive();
export const appraisalOverridesSchema = z.object({
  lease: z.object({ weeklyMin: amount.nullable().optional(), weeklyMax: amount.nullable().optional(), weeklyMidpoint: amount.nullable().optional() }).optional(),
  sales: z.object({ priceMin: amount.nullable().optional(), priceMax: amount.nullable().optional(), priceMidpoint: amount.nullable().optional() }).optional(),
});
export type AppraisalOverrides = z.infer<typeof appraisalOverridesSchema>;

export function normalizeAdvertisedPrice(value: string | null | undefined, purpose: PricePurpose) {
  const text = value?.trim();
  if (!text) return null;
  let normalized = normalizeDisplayPrice(text) ?? text;
  if (/^\d+(?:\.\d+)?$/.test(normalized)) normalized = `$${Number(normalized).toLocaleString("en-AU")}`;
  const amounts = extractPropertyPriceAmounts(normalized);
  const weekly = /per\s*week|\bpw\b|\/w(?:k|eek)|weekly/i.test(text);
  if (purpose === "sale" && (weekly || amounts.some((n) => n < 50_000))) return null;
  if (purpose === "lease" && (amounts.some((n) => n >= 50_000) || /per\s*(?:month|annum|year)|\/mo|monthly|annually/i.test(text))) return null;
  return purpose === "lease" && amounts.length ? `${normalized} per week` : normalized;
}

/** Explicit fields (including clears) win. Legacy prices only belong to their original purpose. */
export function resolveAdvertisedPrice(listing: Pick<Listing, "listing_purpose" | "display_price" | "scraped_listing_json" | "advertised_sale_price" | "advertised_weekly_rent">, purpose: PricePurpose) {
  const explicit = purpose === "sale" ? listing.advertised_sale_price : listing.advertised_weekly_rent;
  if (explicit !== undefined) return normalizeAdvertisedPrice(explicit, purpose);
  if (listing.listing_purpose !== purpose) return null;
  return normalizeAdvertisedPrice(listing.display_price ?? listing.scraped_listing_json?.displayPrice, purpose);
}

export function avmPriceSuggestion(listing: Listing, purpose: PricePurpose) {
  const avm = listing.scraped_listing_json?.domainAvm;
  const estimate = purpose === "lease" ? avm?.rentalEstimate : avm?.valuation;
  const value = purpose === "lease" ? avm?.rentalEstimate?.weeklyRent : avm?.valuation?.midPrice;
  if (!value || !Number.isFinite(value) || value <= 0) return null;
  return {
    value,
    display: `$${value.toLocaleString("en-AU")}${purpose === "lease" ? " per week" : ""}`,
    date: estimate?.date?.slice(0, 10),
    confidence: estimate?.confidence,
  };
}

export function validPriceBand(min?: number | null, max?: number | null, mid?: number | null) {
  return !(min != null && max != null && min > max) &&
    !(mid != null && min != null && mid < min) && !(mid != null && max != null && mid > max);
}
