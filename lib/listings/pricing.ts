import { matchesUsProfile } from "@/lib/us-property/normalise";
import { marketForCountry, monthlyToWeekly, money, rentRange, weeklyToMonthly } from "@/lib/property-market";
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
  // Preserve exact weekly equivalents of monthly US rents (round only for display).
  const weeklyAmounts = extractPropertyPriceAmounts(text);
  if (purpose === "lease" && /per\s*week|\bpw\b|\/w(?:k|eek)|weekly/i.test(text) && weeklyAmounts.length && weeklyAmounts.every((n) => n < 50_000)) return `${weeklyAmounts.map((n) => `$${n}`).join(" – ")} per week`;
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
  if (marketForCountry(listing.country).country === "US") {
    const profile = listing.scraped_listing_json?.usProperty;
    if (!matchesUsProfile(listing, profile)) return null;
    const value = purpose === "lease" ? profile?.rentMonthly && monthlyToWeekly(profile.rentMonthly.mid) : profile?.valuation?.mid;
    if (!value) return null;
    const market = marketForCountry(listing.country);
    return { value, display: purpose === "lease" ? rentRange(value, value, market) : money(value, market), date: profile?.observedAt.slice(0,10), confidence: undefined };
  }
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

/** The price form uses the local rent period; storage keeps the existing weekly column. */
export function rentPriceForInput(weekly: string | null | undefined, country?: string | null) {
  if (marketForCountry(country).country !== "US" || !weekly) return weekly ?? "";
  const amounts = extractPropertyPriceAmounts(weekly);
  return amounts.length ? `${amounts.map((n) => `US$${Number(weeklyToMonthly(n).toFixed(6)).toLocaleString("en-US", { maximumFractionDigits: 6 })}`).join(" – ")} per month` : weekly;
}
export function rentPriceFromInput(value: string, country?: string | null) {
  if (marketForCountry(country).country !== "US" || !value.trim()) return value;
  const text = value.trim();
  const amounts = extractPropertyPriceAmounts(/^\d/.test(text) ? `$${text}` : text);
  return amounts.length ? `${amounts.map((n) => `$${monthlyToWeekly(n)}`).join(" – ")} per week` : text;
}
