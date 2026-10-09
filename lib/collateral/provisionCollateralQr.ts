import type { Agency, CollateralItem, Listing } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isBrochureDocument, isBusinessCardDocument } from "@/lib/collateral/templates/types";

/** Compatibility wrapper: QR choices belong to the document, never the listing. */
export async function provisionCollateralQr({ listing, collateral }: {
  agency: Agency; listing: Listing; collateral: CollateralItem; supabase: SupabaseClient;
}) {
  const doc = collateral.document_json;
  const supported = doc && (isBrochureDocument(doc) || isBusinessCardDocument(doc)) ? doc : null;
  return {
    provisionedListing: listing,
    qrCodeUrl: supported?.assets.qr_code_url ?? "",
    qrTargetUrl: supported?.qr_target_url ?? "",
  };
}
