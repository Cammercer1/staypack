import { countryName, marketForCountry } from "@/lib/property-market";
import { resolveAdvertisedPrice, rentPriceForInput, rentPriceFromInput } from "./pricing";
import { z } from "zod";
import { createEmptyListingDraft } from "./emptyListingDraft";
import {
  parsedListingSchema,
  updateListingSchema,
} from "@/lib/validation/schemas";
import type { Listing } from "@/lib/types";
import type { ListingAgentDraft } from "@/lib/reports/listingAgents";

const optionalCount = z
  .string()
  .refine(
    (value) =>
      value.trim() === "" || (/^\d+$/.test(value) && Number(value) <= 100),
    "Enter a whole number from 0 to 100, or leave blank",
  );
export const newListingFormSchema = z.object({
  country: z.enum(["AU", "US"]).optional(),
  property_address: z.string().trim().min(1, "Enter the property address"),
  suburb: z.string(),
  state: z.string(),
  postcode: z.string(),
  property_type: z.string(),
  bedrooms: optionalCount,
  bathrooms: z.string().refine((value) => !value.trim() || /^(?:\d+)(?:\.5)?$/.test(value) && Number(value) <= 100, "Enter a bathroom count in increments of 0.5"),
  car_spaces: optionalCount,
  listing_title: z.string(),
  listing_description: z.string(),
  advertised_sale_price: z.string(),
  advertised_weekly_rent: z.string(),
  bond: z.string(),
}).superRefine((values, ctx) => {
  const valid = marketForCountry(values.country).country === "US" ? /^\d{5}(?:-\d{4})?$/.test(values.postcode.trim()) : /^\d{4}$/.test(values.postcode.trim());
  if (values.postcode.trim() && !valid) ctx.addIssue({ code: "custom", path: ["postcode"], message: values.country === "US" ? "Enter a five-digit ZIP code (optional +4)" : "Enter a four-digit postcode" });
});
export type NewListingValues = z.infer<typeof newListingFormSchema>;

export function valuesFromListing(listing: Listing): NewListingValues {
  return {
    country: marketForCountry(listing.country).country,
    property_address: listing.property_address ?? "",
    suburb: listing.suburb ?? "",
    state: listing.state ?? "",
    postcode: listing.postcode ?? "",
    property_type: listing.property_type ?? "",
    bedrooms: listing.bedrooms?.toString() ?? "",
    bathrooms: listing.bathrooms?.toString() ?? "",
    car_spaces: listing.car_spaces?.toString() ?? "",
    listing_title: listing.listing_title ?? "",
    listing_description: listing.listing_description ?? "",
    advertised_sale_price: resolveAdvertisedPrice(listing, "sale") ?? "",
    advertised_weekly_rent: rentPriceForInput(resolveAdvertisedPrice(listing, "lease"), listing.country),
    bond: listing.bond ?? "",
  };
}

export function newListingPayload(
  draft: Listing,
  values: NewListingValues,
  agents: ListingAgentDraft[],
) {
  const rent = rentPriceFromInput(values.advertised_weekly_rent, values.country);
  const nullable = (value: string) => value.trim() || null;
  const count = (value: string) => (value.trim() ? Number(value) : null);
  const addressChanged = (
    ["property_address", "suburb", "state", "postcode"] as const
  ).some((key) => values[key].trim() !== (draft[key] ?? "").trim());
  return {
    ...values,
    // Retain the imported listing context; users choose their document type later.
    listing_purpose: draft.listing_purpose,
    suburb: nullable(values.suburb),
    state: nullable(values.state),
    postcode: nullable(values.postcode),
    property_type: nullable(values.property_type),
    bedrooms: count(values.bedrooms),
    bathrooms: count(values.bathrooms),
    car_spaces: count(values.car_spaces),
    listing_title: nullable(values.listing_title),
    listing_description: nullable(values.listing_description),
    display_price: nullable(draft.listing_purpose === "lease" ? rent : values.advertised_sale_price),
    advertised_sale_price: nullable(values.advertised_sale_price),
    advertised_weekly_rent: nullable(rent),
    bond: draft.listing_purpose === "lease" ? nullable(values.bond) : null,
    country: countryName(values.country),
    listing_url: draft.listing_url || null,
    latitude: addressChanged ? null : draft.latitude,
    longitude: addressChanged ? null : draft.longitude,
    hero_image_url: draft.hero_image_url,
    selected_image_urls: draft.selected_image_urls ?? [],
    uploaded_image_urls: draft.uploaded_image_urls ?? [],
    listing_image_meta: draft.listing_image_meta ?? {},
    // Keep provider evidence separate from reviewed fields and contacts.
    scraped_listing_json: draft.scraped_listing_json ?? undefined,
    listing_agents: agents.map((agent) => ({
      ...agent,
      name: agent.name.trim(),
    })),
  };
}

// Draft storage accepts incomplete form values so an unfinished edit can be recovered.
const storedValues = z.object({ ...newListingFormSchema.shape,
  advertised_sale_price: z.string().default(""),
  advertised_weekly_rent: z.string().default(""),
  property_address: z.string(),
  postcode: z.string(),
  bedrooms: z.string(),
  bathrooms: z.string(),
  car_spaces: z.string(),
});
const storedListing = updateListingSchema
  .omit({ collateral_image_selections: true })
  .extend({
    selected_image_urls: z.array(z.string()).nullable().optional(),
    uploaded_image_urls: z.array(z.string()).nullable().optional(),
    scraped_listing_json: parsedListingSchema.nullable().optional(),
  });
const storedDraftSchema = z.object({
  version: z.literal(1),
  savedAt: z.number(),
  step: z.enum(["find", "review"]),
  mode: z.enum(["address", "url"]),
  query: z.string(),
  url: z.string(),
  draft: storedListing.nullable(),
  values: storedValues,
  agents: z
    .array(
      z.object({
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        role_title: z.string(),
        photo_url: z.string(),
      }),
    )
    .max(2),
});
export function restoreNewListingDraft(raw: string | null) {
  if (!raw) return null;
  try {
    const previous = JSON.parse(raw);
    if (previous?.values && typeof previous.values.display_price === "string") {
      const key = previous.draft?.listing_purpose === "lease" ? "advertised_weekly_rent" : "advertised_sale_price";
      previous.values[key] ??= previous.values.display_price;
    }
    const saved = storedDraftSchema.parse(previous);
    if (Date.now() - saved.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return {
      ...saved,
      draft: saved.draft
        ? createEmptyListingDraft({
            ...saved.draft,
            scraped_listing_json: (saved.draft.scraped_listing_json ??
              null) as Listing["scraped_listing_json"],
          })
        : null,
    };
  } catch {
    return null;
  }
}
