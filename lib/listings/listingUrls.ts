import { getSiteUrl } from "@/lib/env";
import type { Listing } from "@/lib/types";

/** StayPacks redirect URL encoded in QR codes — logs the scan then forwards. */
export function buildListingQrTrackingUrl(
  agencySlug: string,
  listingSlug: string,
) {
  const base = getSiteUrl().replace(/\/$/, "");
  return `${base}/go/${agencySlug}/${listingSlug}`;
}

export function buildPublicListingUrl(agencySlug: string, listingSlug: string) {
  const base = getSiteUrl().replace(/\/$/, "");
  return `${base}/${agencySlug}/l/${listingSlug}`;
}

/** Where visitors should land after a QR scan or link click. */
export function resolveListingDestinationUrl(
  listing: Pick<Listing, "custom_landing_url" | "public_url">,
) {
  const custom = listing.custom_landing_url?.trim();
  if (custom) return custom;

  const fallback = listing.public_url?.trim();
  return fallback || null;
}

/** Avoid double-counting when QR redirects to the StayPacks landing page. */
export function appendViaQrParam(destinationUrl: string) {
  try {
    const parsed = new URL(destinationUrl);
    parsed.searchParams.set("via", "qr");
    return parsed.toString();
  } catch {
    return destinationUrl;
  }
}

export function isSameListingPageUrl(a: string, b: string) {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.origin === right.origin && left.pathname === right.pathname;
  } catch {
    return a === b;
  }
}

export function buildListingQrRedirectDestination(
  listing: Pick<Listing, "custom_landing_url" | "public_url">,
) {
  const destination = resolveListingDestinationUrl(listing);
  if (!destination) return null;

  const publicUrl = listing.public_url?.trim();
  if (publicUrl && isSameListingPageUrl(destination, publicUrl)) {
    return appendViaQrParam(destination);
  }

  return destination;
}
