import {
  buildSalesBrochureDocument,
  getMockSalesBrochureCopy,
} from "@/lib/collateral/buildSalesBrochureDocument";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import type { SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";
import type { Agency, CollateralItem, Listing } from "@/lib/types";

/** Draft brochure for template picker preview (listing photos + placeholder QR). */
export function buildSalesBrochureTemplatePreview({
  agency,
  listing,
  collateral,
  templateId,
}: {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  templateId: string;
}): SalesBrochureDocumentJson {
  const playground = createPlaygroundSalesBrochureDocument(templateId);

  return buildSalesBrochureDocument({
    agency,
    listing,
    collateral: { ...collateral, template_id: templateId },
    copy: getMockSalesBrochureCopy(listing, agency),
    qrCodeUrl: playground.assets.qr_code_url,
    qrTargetUrl: playground.qr_target_url,
  });
}
