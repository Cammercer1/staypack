import { createHash } from "crypto";

export function sourceSiteFromUrl(listingUrl: string): string {
  try {
    return new URL(listingUrl).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/** Stable ID from URL path; falls back to address hash when path is generic. */
export function sourceListingIdFromUrl(
  listingUrl: string,
  addressHint?: string | null,
): string {
  try {
    const url = new URL(listingUrl);
    const path = url.pathname.replace(/\/+$/, "");
    const segments = path.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && last.length >= 4 && !/^page$/i.test(last)) {
      return `${url.hostname}:${last}`;
    }
  } catch {
    // fall through
  }

  if (addressHint?.trim()) {
    return createHash("sha256")
      .update(addressHint.trim().toLowerCase())
      .digest("hex")
      .slice(0, 32);
  }

  return createHash("sha256").update(listingUrl).digest("hex").slice(0, 32);
}

export function newDeliveryId(
  tenantId: string,
  sourceListingId: string,
): string {
  const stamp = Date.now();
  return `${tenantId}:${sourceListingId}:${stamp}`;
}
