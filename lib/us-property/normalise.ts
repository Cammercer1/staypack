import { z } from "zod";
import { normaliseUsStreet } from "./address";
import { monthlyToWeekly, money, marketForCountry } from "@/lib/property-market";
import type { ParsedListing } from "@/lib/types";
const nullableNumber = z.number().finite().nullish();
export const propertySchema = z.object({
  zpid: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(String),
  address: z.object({ streetAddress: z.string().min(1), city: z.string().min(1), state: z.string().regex(/^[A-Z]{2}$/), zipcode: z.string().regex(/^\d{5}(?:-\d{4})?$/) }),
  country: z.enum(["USA", "US"]).optional(), currency: z.literal("USD").optional(),
  homeStatus: z.string(), homeType: z.string().nullish(),
  bedrooms: nullableNumber, bathrooms: nullableNumber, livingArea: nullableNumber,
  lotAreaValue: nullableNumber, lotAreaUnits: z.string().nullish(),
  latitude: nullableNumber, longitude: nullableNumber, price: nullableNumber,
  zestimate: nullableNumber, rentZestimate: nullableNumber,
  zestimateLowPercent: z.union([z.string(), z.number()]).nullish(), zestimateHighPercent: z.union([z.string(), z.number()]).nullish(),
  restimateLowPercent: z.union([z.string(), z.number()]).nullish(), restimateHighPercent: z.union([z.string(), z.number()]).nullish(),
  lastSoldPrice: nullableNumber, dateSold: z.union([z.number(), z.string()]).nullish(),
  description: z.string().nullish(), responsivePhotos: z.array(z.object({ url: z.string().optional() }).passthrough()).nullish(),
  resoFacts: z.object({ garageSpaces: nullableNumber, hasPrivatePool: z.boolean().nullish(), hasSpa: z.boolean().nullish(), hasCooling: z.boolean().nullish() }).passthrough().nullish(),
}).passthrough();
const positive = (n?: number | null) => n != null && n > 0 ? n : undefined;
function band(mid?: number | null, low?: string | number | null, high?: string | number | null) {
  if (!positive(mid)) return undefined;
  const percent = (v?: string | number | null) => v == null || v === "" ? undefined : Number(v);
  const l = percent(low), h = percent(high);
  return { mid: mid!, low: l != null && l >= 0 && l < 100 ? mid! * (1 - l / 100) : undefined, high: h != null && h >= 0 && h < 100 ? mid! * (1 + h / 100) : undefined };
}
export function normaliseUsProperty(raw: unknown): { parsed: ParsedListing; latitude: number | null; longitude: number | null; url: string } {
  const p = propertySchema.parse(raw);
  const now = new Date().toISOString();
  const market = marketForCountry("US");
  const valuation = band(p.zestimate, p.zestimateLowPercent, p.zestimateHighPercent);
  const rentMonthly = band(p.rentZestimate, p.restimateLowPercent, p.restimateHighPercent);
  const photos = [...new Set((p.responsivePhotos ?? []).flatMap((photo) => photo.url?.startsWith("https://") ? [photo.url] : []))];
  const advertisedSale = p.homeStatus === "FOR_SALE" && positive(p.price) ? money(p.price, market) : null;
  const advertisedRent = p.homeStatus === "FOR_RENT" && positive(p.price) ? `$${monthlyToWeekly(p.price!)} per week` : null;
  const type = ({ SINGLE_FAMILY: "House", CONDO: "Apartment", TOWNHOUSE: "Townhouse", MULTI_FAMILY: "Multi-family", APARTMENT: "Apartment" } as Record<string,string>)[p.homeType ?? ""] ?? p.homeType ?? undefined;
  const sold = p.dateSold == null ? null : new Date(typeof p.dateSold === "number" && p.dateSold < 1e11 ? p.dateSold * 1000 : p.dateSold);
  const parsed: ParsedListing = {
    country: "US", address: p.address.streetAddress, suburb: p.address.city, state: p.address.state, postcode: p.address.zipcode,
    propertyType: type, purpose: p.homeStatus === "FOR_RENT" ? "lease" : "sale",
    bedrooms: p.bedrooms ?? undefined, bathrooms: p.bathrooms ?? undefined, carSpaces: p.resoFacts?.garageSpaces ?? undefined,
    description: p.description ?? undefined, displayPrice: advertisedSale ?? advertisedRent ?? undefined,
    floorAreaSqm: positive(p.livingArea) ? p.livingArea! * 0.09290304 : undefined,
    landAreaSqm: positive(p.lotAreaValue) ? /acre/i.test(p.lotAreaUnits ?? "") ? p.lotAreaValue! * 4046.8564224 : /sqft|square feet|sq ft/i.test(p.lotAreaUnits ?? "") ? p.lotAreaValue! * 0.09290304 : undefined : undefined,
    images: photos, agents: [], confidence: "low",
    warnings: ["Automated property and monthly rent estimates are indicative. Review condition, comparable evidence and local restrictions before relying on them.", ...(!valuation ? ["No current property value estimate is available. Enter your own appraisal."] : []), ...(!rentMonthly ? ["No monthly rent estimate is available. Enter your own rental appraisal."] : [])],
    usProperty: { address: p.address, zpid: p.zpid, currency: "USD", observedAt: now, homeStatus: p.homeStatus, valuation, rentMonthly,
      lastSold: positive(p.lastSoldPrice) ? { price: p.lastSoldPrice!, date: sold && Number.isFinite(sold.getTime()) ? sold.toISOString().slice(0,10) : undefined } : undefined,
      raw: p,
    },
    propertyLookup: { source: "zillow", matchedAt: now, zpid: p.zpid, advertisedSalePrice: advertisedSale, advertisedWeeklyRent: advertisedRent,
      media: photos.map((url) => ({ url, role: "photo", current: ["FOR_SALE", "FOR_RENT"].includes(p.homeStatus) })),
      features: [p.resoFacts?.hasPrivatePool && "Pool", p.resoFacts?.hasSpa && "Spa", p.resoFacts?.hasCooling && "Air conditioning", positive(p.resoFacts?.garageSpaces) && "Garage"].filter((v): v is string => typeof v === "string"),
    },
  };
  return { parsed, latitude: p.latitude ?? null, longitude: p.longitude ?? null, url: `https://www.zillow.com/homedetails/${p.zpid}_zpid/` };
}
export { normaliseUsStreet } from "./address";
export function matchesUsAddress(subject: { address?: string | null; state?: string | null; postcode?: string | null }, parsed: Pick<ParsedListing, "address" | "state" | "postcode">) {
  return normaliseUsStreet(subject.address ?? "") === normaliseUsStreet(parsed.address ?? "") &&
    !!subject.state && subject.state.toUpperCase() === parsed.state &&
    !!subject.postcode && subject.postcode.slice(0,5) === parsed.postcode?.slice(0,5);
}

export function matchesUsProfile(subject: { property_address?: string | null; state?: string | null; postcode?: string | null }, profile?: ParsedListing["usProperty"]) {
  return !!profile && matchesUsAddress({ address: subject.property_address, state: subject.state, postcode: subject.postcode }, {
    address: profile.address.streetAddress, state: profile.address.state, postcode: profile.address.zipcode,
  });
}
