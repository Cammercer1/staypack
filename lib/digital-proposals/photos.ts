import { z } from "zod";
import { getListingImagePool } from "@/lib/listings/collateralImages";
import { MAX_LANDING_IMAGES } from "@/lib/listings/collateralImageLimits";
import type { Listing } from "@/lib/types";
import { assetUrlSchema } from "./assets";
import type { ProposalData } from "./data";

const photoUrlSchema = assetUrlSchema.refine(value => value.trim().length > 0, "Choose a property photo.");
export const proposalPhotoSelectionSchema = z.object({
  heroImageUrl: photoUrlSchema,
  gallery: z.array(photoUrlSchema).min(1, "Select at least one property photo.").max(MAX_LANDING_IMAGES),
}).strict().superRefine((selection, ctx) => {
  if (!selection.gallery.includes(selection.heroImageUrl)) ctx.addIssue({ code: "custom", path: ["heroImageUrl"], message: "Include the cover photo in your selected photos." });
});
export type ProposalPhotoSelection = z.infer<typeof proposalPhotoSelectionSchema>;

/** Preserve the report's saved images as choices alongside the current property library. */
export function availableProposalPhotos(listing: Pick<Listing, "scraped_listing_json" | "uploaded_image_urls">, data: ProposalData): string[] {
  return [...new Set([data.property.heroImageUrl, ...data.property.gallery, ...getListingImagePool(listing)])]
    .filter(url => photoUrlSchema.safeParse(url).success);
}

/** Only the proposal draft changes; the property library and published versions stay untouched. */
export function withProposalPhotos(data: ProposalData, selection?: ProposalPhotoSelection): ProposalData {
  if (!selection) return data;
  return { ...data, property: { ...data.property, heroImageUrl: selection.heroImageUrl, gallery: [...selection.gallery] } };
}
