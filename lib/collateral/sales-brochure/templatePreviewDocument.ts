import {
  buildBrochureDocument,
  getMockRentalBrochureCopy,
  getMockSalesBrochureCopy,
} from "@/lib/collateral/buildSalesBrochureDocument";
import { isBrochureDocument, type BrochureDocumentJson } from "@/lib/collateral/templates/types";
import { applyDocumentLinkDraft } from "@/lib/documents/documentLink";
import type { Agency, CollateralItem, CollateralType, Listing } from "@/lib/types";

type BrochureCollateralType = Extract<
  CollateralType,
  "sales_brochure" | "rental_brochure"
>;

/** Draft brochure preview using the document's own optional QR choice. */
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
  const existing = collateral.document_json && isBrochureDocument(collateral.document_json)
    ? collateral.document_json
    : null;
  const mockCopy =
    collateralType === "rental_brochure"
      ? getMockRentalBrochureCopy(listing, agency)
      : getMockSalesBrochureCopy(listing, agency);

  return applyDocumentLinkDraft(buildBrochureDocument({
    collateralType,
    agency,
    listing,
    collateral: { ...collateral, template_id: templateId },
    copy: mockCopy,
    qrCodeUrl: existing?.assets.qr_code_url ?? "",
    qrTargetUrl: existing?.qr_target_url ?? "",
  }));
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
