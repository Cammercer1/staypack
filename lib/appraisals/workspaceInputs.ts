import { z } from "zod";
import { mergeAppraisalResults, resolveAppraisalInput, hasStaleAppraisal } from "./resolveAppraisalInput";
import { applyLeaseAppraisalCompSelection } from "@/lib/lease-appraisal/leaseAppraisalData";
import { applySalesAppraisalCompSelection, applySalesAppraisalAgentReviewConfirmation } from "@/lib/sales-appraisal/salesAppraisalData";
import { validPriceBand } from "@/lib/listings/pricing";
import type { Listing } from "@/lib/types";
import type { AppraisalInputs, WorkspaceAppraisal } from "./workspaceTypes";

export function captureAppraisalInputs(listing: Listing): AppraisalInputs {
  return { version: 1, listing: structuredClone(listing) };
}
/** A private working copy; IDs, tenancy and archive state always come from the real property. */
export function appraisalListing(listing: Listing, appraisal: WorkspaceAppraisal): Listing {
  const saved = appraisal.inputs_json?.listing ?? listing;
  return { ...saved, id: listing.id, agency_id: listing.agency_id, status: listing.status, updated_at: appraisal.updated_at };
}
export const appraisalPropertySchema = z.object({
  property_address: z.string().trim().min(1).max(300), suburb: z.string().trim().min(1).max(120),
  state: z.string().trim().min(2).max(30), postcode: z.string().trim().min(3).max(12),
  property_type: z.string().trim().min(1).max(80), bedrooms: z.number().int().min(1).max(50),
  bathrooms: z.number().min(0).max(50), car_spaces: z.number().int().min(0).max(50).nullable(),
  listing_description: z.string().max(12000).nullable().optional(),
  hero_image_url: z.string().url().optional(),
}).strict();
export const appraisalEvidenceSchema = z.object({
  expected_updated_at: z.iso.datetime({ offset: true }), reset_price: z.boolean().optional(),
  weekly_min: z.number().positive().nullable().optional(), weekly_max: z.number().positive().nullable().optional(), weekly_midpoint: z.number().positive().nullable().optional(),
  price_min: z.number().positive().nullable().optional(), price_max: z.number().positive().nullable().optional(), price_midpoint: z.number().positive().nullable().optional(),
  selected_comp_listing_ids: z.array(z.string().min(1)).max(6).optional(), agent_review_confirmed: z.boolean().optional(),
}).strict();
export function editAppraisalEvidence(listing: Listing, kind: "lease" | "sales", body: z.infer<typeof appraisalEvidenceSchema>): Listing {
  if (hasStaleAppraisal(listing, kind)) throw new Error("Property details changed. Fetch comparables again before saving appraisal data.");
  let parsed = resolveAppraisalInput(listing, { applyOverrides: false });
  const overrides = { ...listing.appraisal_overrides_json };
  const values = kind === "lease" ? [body.weekly_min, body.weekly_max, body.weekly_midpoint] : [body.price_min, body.price_max, body.price_midpoint];
  if (body.reset_price) delete overrides[kind];
  else if (values.some(value => value != null)) {
    const [min, max, mid] = values.map(value => value ?? null);
    if (!validPriceBand(min, max, mid)) throw new Error("Minimum must not exceed maximum, and midpoint must be within the range.");
    if (kind === "lease") overrides.lease = { weeklyMin: min, weeklyMax: max, weeklyMidpoint: mid };
    else overrides.sales = { priceMin: min, priceMax: max, priceMidpoint: mid };
  }
  if (body.selected_comp_listing_ids) parsed = kind === "lease" ? applyLeaseAppraisalCompSelection(parsed, body.selected_comp_listing_ids) : applySalesAppraisalCompSelection(parsed, body.selected_comp_listing_ids);
  if (kind === "sales" && body.agent_review_confirmed != null) parsed = applySalesAppraisalAgentReviewConfirmation(parsed, body.agent_review_confirmed);
  return { ...listing, scraped_listing_json: mergeAppraisalResults(listing, kind, parsed), appraisal_overrides_json: overrides };
}
