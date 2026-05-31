import {
  buildBrochureDocument,
  getMockRentalBrochureCopy,
  getMockSalesBrochureCopy,
} from "@/lib/collateral/buildSalesBrochureDocument";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import type { Agency, CollateralItem, CollateralType, Listing } from "@/lib/types";

type BrochureCollateralType = Extract<
  CollateralType,
  "sales_brochure" | "rental_brochure"
>;

/** Draft brochure for template picker preview (listing photos + placeholder QR). */
export function buildBrochureTemplatePreview({
  agency,
  listing,
  collateral,
  templateId,
  collateralType,
}: {
  agency: Agency;
  listing: Listing;
  collateral: CollateralItem;
  templateId: string;
  collateralType: BrochureCollateralType;
}): BrochureDocumentJson {
  const playground = createPlaygroundSalesBrochureDocument(templateId);
  const mockCopy =
    collateralType === "rental_brochure"
      ? getMockRentalBrochureCopy(listing, agency)
      : getMockSalesBrochureCopy(listing, agency);

  return buildBrochureDocument({
    collateralType,
    agency,
    listing,
    collateral: { ...collateral, template_id: templateId },
    copy: mockCopy,
    qrCodeUrl: playground.assets.qr_code_url,
    qrTargetUrl: playground.qr_target_url,
  });
}

/** @deprecated Use buildBrochureTemplatePreview */
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
}): BrochureDocumentJson {
  return buildBrochureTemplatePreview({
    agency,
    listing,
    collateral,
    templateId,
    collateralType: "sales_brochure",
  });
}
