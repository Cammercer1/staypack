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
  // #region agent log
  fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a515ca",
    },
    body: JSON.stringify({
      sessionId: "a515ca",
      location: "provisionLandingPage.ts:provision",
      message: "Resolved public URL for listing",
      data: {
        listingId: listing.id,
        storedPublicUrl,
        storedHost,
        canonicalPublicUrl,
        canonicalHost,
        publicUrl,
        needsUrlRefresh,
      },
      timestamp: Date.now(),
      hypothesisId: "H1",
    }),
  }).catch(() => {});
  // #endregion
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

export async function ensureListingLandingProvisioned(
  listing: Listing,
  agency: Agency,
  supabase: SupabaseClient,
): Promise<Listing> {
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
