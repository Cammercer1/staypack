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

function isStalePublicUrl(stored: string, canonical: string) {
  try {
    const storedUrl = new URL(stored);
    if (
      storedUrl.hostname === "localhost" ||
      storedUrl.hostname.startsWith("127.")
    ) {
      return true;
    }
    const canonicalUrl = new URL(canonical);
    return storedUrl.origin !== canonicalUrl.origin;
  } catch {
    return true;
  }
}

/** Link shown in the app — prefers canonical URL when DB still has localhost. */
export function resolveEffectiveListingPageUrl(
  agencySlug: string,
  listing: Pick<
    Listing,
    "custom_landing_url" | "public_url" | "public_slug"
  >,
) {
  const custom = listing.custom_landing_url?.trim();
  if (custom) return custom;

  if (listing.public_slug) {
    const canonical = buildPublicListingUrl(agencySlug, listing.public_slug);
    const stored = listing.public_url?.trim();
    if (!stored || isStalePublicUrl(stored, canonical)) {
      return canonical;
    }
    return stored;
  }

  return listing.public_url?.trim() || null;
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
  listing: Pick<
    Listing,
    "custom_landing_url" | "public_url" | "public_slug"
  >,
  agencySlug: string,
) {
  const custom = listing.custom_landing_url?.trim();
  if (custom) return custom;

  const destination =
    resolveEffectiveListingPageUrl(agencySlug, listing) ??
    resolveListingDestinationUrl(listing);
  if (!destination) return null;

  const canonical = listing.public_slug
    ? buildPublicListingUrl(agencySlug, listing.public_slug)
    : null;
  if (canonical && isSameListingPageUrl(destination, canonical)) {
    return appendViaQrParam(destination);
  }

  return destination;
}
