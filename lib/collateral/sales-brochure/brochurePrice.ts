import { z } from "zod";
import {
  normalizeAdvertisedPrice,
  resolveAdvertisedPrice,
} from "@/lib/listings/pricing";
import {
  isBrochureDocument,
  resolveBrochurePrice,
} from "@/lib/collateral/templates/types";
import type { CollateralItem, Listing } from "@/lib/types";

export const brochurePriceFormSchema = z.object({
  price_value: z
    .string()
    .trim()
    .min(1, "Enter a price or choose Contact agent before continuing.")
    .max(60, "Keep the brochure price to 60 characters or fewer."),
});

export const generateBrochurePriceSchema = brochurePriceFormSchema.partial();

export function initialBrochurePrice(
  listing: Listing,
  collateral: CollateralItem,
): string {
  const document = collateral.document_json;
  if (document && isBrochureDocument(document)) {
    const savedPrice = resolveBrochurePrice(document).trim();
    if (savedPrice) return savedPrice;
  }
  return (
    resolveAdvertisedPrice(
      listing,
      collateral.type === "rental_brochure" ? "lease" : "sale",
    ) ?? ""
  );
}

export function formatBrochurePrice(value: string, rental: boolean): string {
  return normalizeAdvertisedPrice(value, rental ? "lease" : "sale") ?? value.trim();
}
