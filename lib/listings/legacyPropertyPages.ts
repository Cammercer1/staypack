import type { Listing } from "@/lib/types";

/** Retained source for restoration; the report product does not create pages or manage leads. */
export const LEGACY_PROPERTY_PAGE_TOOLS = false;

export function hasLegacyPropertyPage(listing: Pick<Listing,
  "landing_published_at" | "public_url" | "landing_qr_code_url" | "custom_landing_url"
>) {
  return Boolean(listing.landing_published_at || listing.public_url || listing.landing_qr_code_url || listing.custom_landing_url);
}
