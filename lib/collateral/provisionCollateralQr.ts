import { createAdminClient } from "@/lib/supabase/admin";
import { ensureListingLandingProvisioned } from "@/lib/listings/provisionLandingPage";
import {
  buildListingQrTrackingUrl,
  resolveListingDestinationUrl,
} from "@/lib/listings/listingUrls";
import { generateQrCodeBuffer } from "@/lib/reports/qr";
import type { Agency, CollateralItem, Listing } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function provisionCollateralQr({
  agency,
  listing,
  collateral,
  supabase,
}: {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  supabase: SupabaseClient;
}) {
  const provisionedListing = await ensureListingLandingProvisioned(
    listing,
    agency,
    supabase,
  );

  const qrTrackingUrl = buildListingQrTrackingUrl(
    agency.slug,
    provisionedListing.public_slug!,
  );
  const qrDestinationUrl = resolveListingDestinationUrl(provisionedListing);

  if (!qrDestinationUrl) {
    throw new Error("Listing landing page is not provisioned");
  }

  const admin = createAdminClient();
  const qrBuffer = await generateQrCodeBuffer(qrTrackingUrl);
  const qrVersion = Date.now();
  const qrPath = `${agency.id}/${listing.id}/collateral-${collateral.id}-qr-${qrVersion}.png`;

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
    data: { publicUrl: qrCodeUrl },
  } = admin.storage.from("report-assets").getPublicUrl(qrPath);

  return {
    provisionedListing,
    qrCodeUrl,
    qrTargetUrl: qrDestinationUrl,
  };
}
