import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey, isLegacyPublicUrlHost } from "@/lib/env";
import {
  buildListingQrTrackingUrl,
  buildPublicListingUrl,
} from "@/lib/listings/listingUrls";
import { generateQrCodeBuffer } from "@/lib/reports/qr";
import { generateReportSlug } from "@/lib/reports/slugs";
import type { Agency, Listing } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export { buildPublicListingUrl } from "@/lib/listings/listingUrls";

export function generateListingSlug() {
  return generateReportSlug();
}

type ProvisionResult = {
  public_slug: string;
  public_url: string;
  landing_qr_code_url: string;
  landing_published_at: string;
};

async function uploadListingLandingQr(
  agency: Pick<Agency, "id" | "slug">,
  listingId: string,
  publicSlug: string,
) {
  const trackingUrl = buildListingQrTrackingUrl(agency.slug, publicSlug);
  const admin = createAdminClient();
  const qrBuffer = await generateQrCodeBuffer(trackingUrl);
  const qrPath = `${agency.id}/${listingId}/landing-qr.png`;

  const { error: uploadError } = await admin.storage
    .from("report-assets")
    .upload(qrPath, qrBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl: landingQrCodeUrl },
  } = admin.storage.from("report-assets").getPublicUrl(qrPath);

  return landingQrCodeUrl;
}

export async function provisionListingLanding(
  listing: Pick<
    Listing,
    "id" | "public_slug" | "public_url" | "landing_qr_code_url" | "landing_published_at"
  >,
  agency: Pick<Agency, "id" | "slug">,
  supabase?: SupabaseClient,
): Promise<ProvisionResult> {
  const publicSlug = listing.public_slug ?? generateListingSlug();
  const canonicalPublicUrl = buildPublicListingUrl(agency.slug, publicSlug);
  const storedPublicUrl = listing.public_url?.trim() ?? null;
  const storedHost = storedPublicUrl
    ? (() => {
        try {
          return new URL(storedPublicUrl).host;
        } catch {
          return null;
        }
      })()
    : null;
  const canonicalHost = (() => {
    try {
      return new URL(canonicalPublicUrl).host;
    } catch {
      return null;
    }
  })();
  const needsUrlRefresh =
    !storedPublicUrl ||
    !storedHost ||
    !canonicalHost ||
    isLegacyPublicUrlHost(storedHost, canonicalHost);
  const publicUrl = needsUrlRefresh ? canonicalPublicUrl : storedPublicUrl;
  const landingQrCodeUrl = await uploadListingLandingQr(
    agency,
    listing.id,
    publicSlug,
  );

  const landingPublishedAt = listing.landing_published_at ?? new Date().toISOString();
  const fields: ProvisionResult = {
    public_slug: publicSlug,
    public_url: publicUrl,
    landing_qr_code_url: landingQrCodeUrl,
    landing_published_at: landingPublishedAt,
  };

  if (supabase) {
    const { error } = await supabase
      .from("listings")
      .update(fields)
      .eq("id", listing.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  return fields;
}

function listingLandingIsCurrent(listing: Listing, agency: Agency): boolean {
  if (
    !listing.public_slug ||
    !listing.landing_qr_code_url ||
    !listing.landing_published_at ||
    !listing.public_url
  ) {
    return false;
  }

  let storedHost: string | null;
  let canonicalHost: string | null;
  try {
    storedHost = new URL(listing.public_url).host;
  } catch {
    return false;
  }
  try {
    canonicalHost = new URL(
      buildPublicListingUrl(agency.slug, listing.public_slug),
    ).host;
  } catch {
    return false;
  }

  // A legacy host means the stored URL needs refreshing, so it is not current.
  return !isLegacyPublicUrlHost(storedHost, canonicalHost);
}

export async function ensureListingLandingProvisioned(
  listing: Listing,
  agency: Agency,
  supabase: SupabaseClient,
): Promise<Listing> {
  // Skip the QR regeneration + DB write when the listing is already fully
  // provisioned with a current public URL. This runs on every listing open.
  if (listingLandingIsCurrent(listing, agency)) {
    return listing;
  }

  const fields = await provisionListingLanding(listing, agency);

  const client = hasServiceRoleKey() ? createAdminClient() : supabase;

  const { error } = await client
    .from("listings")
    .update(fields)
    .eq("id", listing.id);

  if (error) {
    throw new Error(error.message);
  }

  return {
    ...listing,
    ...fields,
  };
}
