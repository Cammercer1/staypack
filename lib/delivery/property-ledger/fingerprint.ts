import { createHash } from "crypto";
import type { ParsedListing } from "@/lib/types";

function stableString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

/** Hash fields that indicate a materially different listing for re-process decisions. */
export function computeListingFingerprint(listing: ParsedListing): string {
  const payload = {
    title: stableString(listing.title),
    address: stableString(listing.address),
    suburb: stableString(listing.suburb),
    state: stableString(listing.state),
    postcode: stableString(listing.postcode),
    propertyType: stableString(listing.propertyType),
    purpose: stableString(listing.purpose),
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    carSpaces: listing.carSpaces ?? null,
    displayPrice: stableString(listing.displayPrice),
    description: stableString(listing.description)?.slice(0, 500),
  };

  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}
