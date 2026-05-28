import { createAdminClient } from "@/lib/supabase/admin";
import { buildBusinessCardDocument } from "@/lib/collateral/buildBusinessCardDocument";
import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { ensureListingLandingProvisioned } from "@/lib/listings/provisionLandingPage";
import {
  buildListingQrTrackingUrl,
  resolveListingDestinationUrl,
} from "@/lib/listings/listingUrls";
import { generateQrCodeBuffer } from "@/lib/reports/qr";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type GenerateInput = {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  supabase: SupabaseClient;
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
};

export async function generateCollateralDocument({
  agency,
  listing,
  collateral,
  supabase,
  agentProfile,
  agencyAgents,
}: GenerateInput): Promise<CollateralDocumentJson> {
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
  const qrPath = `${agency.id}/${listing.id}/collateral-${collateral.id}-qr.png`;

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

  switch (collateral.type) {
    case "agent_business_card":
      return buildBusinessCardDocument({
        agency,
        listing: provisionedListing,
        collateral,
        agentProfile,
        agencyAgents,
        qrCodeUrl,
        qrTargetUrl: qrDestinationUrl,
      });
    default:
      throw new Error(`${collateral.type} generation is not implemented yet`);
  }
}
