import { z } from "zod";
import { avmPriceSuggestion, resolveAdvertisedPrice } from "@/lib/listings/pricing";
import { extractPropertyPriceAmounts } from "@/lib/scraping/normalizeDisplayPrice";
import type { Listing, Report } from "@/lib/types";

export const STR_AMENITIES = [
  { id: "pool", label: "Pool", aliases: ["swimming pool", "in ground pool", "inground pool", "indoor pool", "outdoor pool", "pool inground"] },
  { id: "air_conditioning", label: "Air conditioning", aliases: ["air con", "airconditioning", "air conditioned", "split system air conditioning", "ducted cooling", "reverse cycle air conditioning"] },
  { id: "free_parking_on_premises", label: "On-site parking", aliases: ["secure parking", "garage", "carport", "parking", "free parking"] },
  { id: "hot_tub", label: "Spa / hot tub", aliases: ["spa", "outside spa", "inside spa", "spa bath", "jacuzzi"] },
  { id: "wifi", label: "Wi-Fi", aliases: ["wireless internet"] },
  { id: "beach_access", label: "Beach access", aliases: ["beachfront", "direct beach access"] },
  { id: "outdoor_dining_area", label: "Outdoor dining", aliases: ["outdoor entertaining", "outdoor entertainment area"] },
  { id: "bbq_grill", label: "BBQ", aliases: ["barbecue", "barbeque", "bbq area"] },
  { id: "heating", label: "Heating", aliases: ["ducted heating", "gas heating", "electric heating"] },
  { id: "washer", label: "Washing machine", aliases: ["washing machine"] },
  { id: "kitchen", label: "Kitchen", aliases: ["full kitchen"] },
  { id: "dedicated_workspace", label: "Workspace", aliases: ["study", "home office", "dedicated workspace"] },
  { id: "gym", label: "Gym", aliases: ["gymnasium", "fitness centre"] },
  { id: "sauna", label: "Sauna", aliases: [] },
  { id: "patio_or_balcony", label: "Balcony / patio", aliases: ["balcony", "patio", "deck", "terrace"] },
  { id: "waterfront", label: "Waterfront", aliases: ["water front"] },
  { id: "pets_allowed", label: "Pets welcome", aliases: ["pets allowed", "pet friendly"] },
  { id: "ev_charger", label: "EV charger", aliases: ["ev charging", "electric vehicle charger"] },
] as const;

export type StrAmenityId = (typeof STR_AMENITIES)[number]["id"];
const amenityIds = STR_AMENITIES.map((item) => item.id) as [StrAmenityId, ...StrAmenityId[]];
export const strPropertyContextSchema = z.object({
  // Optional for older drafts; null is an explicit clear and must not fall back.
  propertyValue: z.number().finite().positive().max(1_000_000_000).nullable().optional(),
  weeklyRent: z.number().finite().positive().max(50_000).nullable(),
  amenities: z.array(z.enum(amenityIds)).max(STR_AMENITIES.length).transform((values) => [...new Set(values)].sort()),
  additionalAmenities: z.array(z.string().trim().min(1).max(80)).max(20)
    .transform((values) => values.filter((value, index) => values.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index)),
});
export type StrPropertyContext = z.infer<typeof strPropertyContextSchema>;

const normalise = (value: string) => value.toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
export function identifyStrAmenity(value: string): StrAmenityId | undefined {
  const key = normalise(value);
  return STR_AMENITIES.find((item) => [item.id, item.label, ...item.aliases].some((alias) => normalise(alias) === key))?.id;
}
export function importedStrAmenities(listing: Listing) {
  const features = listing.scraped_listing_json?.propertyLookup?.features ?? [];
  return [...new Set(features.flatMap((feature) => {
    const id = identifyStrAmenity(feature);
    return id ? [id] : [];
  }))].sort();
}
export function matchingStrAmenities(selected: readonly string[], available: readonly string[] = []) {
  const known = new Set(available.map(identifyStrAmenity).filter(Boolean));
  return STR_AMENITIES.filter((amenity) => selected.includes(amenity.id) && known.has(amenity.id));
}
export function suggestedWeeklyRent(listing: Listing) {
  const domain = avmPriceSuggestion(listing, "lease");
  if (domain) return { ...domain, source: "Estimated weekly rent" };
  const advertised = resolveAdvertisedPrice(listing, "lease") ?? listing.scraped_listing_json?.propertyLookup?.advertisedWeeklyRent;
  const amounts = advertised ? extractPropertyPriceAmounts(advertised) : [];
  if (amounts.length) return { value: amounts.reduce((a, b) => a + b, 0) / amounts.length, source: "Advertised weekly rent", date: undefined };
  const appraisal = listing.scraped_listing_json?.rentalAppraisal;
  const value = appraisal?.weeklyMidpoint ?? (appraisal?.weeklyMin != null && appraisal.weeklyMax != null ? (appraisal.weeklyMin + appraisal.weeklyMax) / 2 : null);
  return value != null && value > 0 ? { value, source: "Saved rental appraisal", date: undefined } : null;
}
export function readStrPropertyContext(listing: Listing, report: Pick<Report, "user_overrides_json">): StrPropertyContext {
  const saved = strPropertyContextSchema.safeParse(report.user_overrides_json?.strProperty);
  const propertyValue = avmPriceSuggestion(listing, "sale")?.value ?? null;
  return saved.success ? { ...saved.data, propertyValue: saved.data.propertyValue === undefined ? propertyValue : saved.data.propertyValue } : {
    propertyValue,
    weeklyRent: suggestedWeeklyRent(listing)?.value ?? null,
    amenities: importedStrAmenities(listing),
    additionalAmenities: [],
  };
}
