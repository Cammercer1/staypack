import { calculateAccommodates } from "@/lib/reports/formatters";
import { calculatorPropertyReviewKey } from "./propertyReviewIdentity";
import type { Listing, Report } from "@/lib/types";

/** Old reports have no review marker. A confirmed calculator report must still
 * describe the exact property and configuration that the user reviewed. */
export function calculatorPropertyReviewRequired(report: Report, listing: Listing) {
  const review = report.user_overrides_json?.calculatorReview;
  if (!review) return false;
  const inputs = report.user_overrides_json?.estimateInputs;
  return review.status !== "verified" || review.propertyKey !== calculatorPropertyReviewKey(listing) || !inputs ||
    inputs.bedrooms !== listing.bedrooms || inputs.bathrooms !== listing.bathrooms ||
    inputs.accommodates !== calculateAccommodates(listing.bedrooms, listing.accommodates);
}
