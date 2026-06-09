import { buildSalesBrochureDocument } from "@/lib/collateral/buildSalesBrochureDocument";
import { provisionCollateralQr } from "@/lib/collateral/provisionCollateralQr";
import {
  buildPublicCollateralUrl,
  generateCollateralSlug,
} from "@/lib/collateral/slugs";
import { withBrochureContentSaved, withBrochurePdfSynced } from "@/lib/collateral/sales-brochure/brochurePublishSync";
import { getCollateralTemplate } from "@/lib/collateral/templates/registry";
import { DEFAULT_COLLATERAL_TEMPLATE_IDS } from "@/lib/collateral/templates/ids";
import { resolveDeliveryAgency } from "@/lib/delivery/brand/ensureShadowAgency";
import { agentProfileFromBrand } from "@/lib/delivery/brand/agentFromBrand";
import { buildDeliverySalesBrochurePdfFilename } from "@/lib/delivery/reports/pdfFilename";
import { getPrintRenderBaseUrl } from "@/lib/env";
import { generateSalesBrochureCopy } from "@/lib/openai/generateSalesBrochureCopy";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { cacheBustedPdfUrl } from "@/lib/reports/cacheBustedPdfUrl";
import type { ReportAgent } from "@/lib/reports/resolveReportAgents";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderPdfFromUrl, buildPdfImagePath, buildPdfStylesheetPath } from "@/lib/browserless/pdf";
import type { DeliveryTenant } from "@/lib/delivery/types";
import type { Agency, AgentProfile, CollateralItem, Listing } from "@/lib/types";

export type HeadlessSalesBrochureResult = {
  collateralId: string;
  listingId: string;
  pdfBuffer: Buffer;
  pdfUrl: string;
  publicUrl: string;
  pdfFilename: string;
  address: string;
};

export async function generateHeadlessSalesBrochure({
  tenant,
  listing,
  agency: existingAgency,
  templateIdOverride,
  resolvedAgents,
  agentProfile: agentProfileOverride,
  agencyAgents: agencyAgentsOverride,
}: {
  tenant: DeliveryTenant;
  listing: Listing;
  agency?: Agency;
  templateIdOverride?: string;
  resolvedAgents?: ReportAgent[];
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
}): Promise<HeadlessSalesBrochureResult> {
  const admin = createAdminClient();

  const agency =
    existingAgency ??
    (await resolveDeliveryAgency({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      agencyId: tenant.agency_id,
      brand: tenant.brand,
    }));

  const templateId =
    templateIdOverride ?? DEFAULT_COLLATERAL_TEMPLATE_IDS.sales_brochure;

  const { data: collateral, error: collateralError } = await admin
    .from("collateral_items")
    .insert({
      listing_id: listing.id,
      agency_id: agency.id,
      type: "sales_brochure",
      status: "draft",
      template_id: templateId,
    })
    .select("*")
    .single();

  if (collateralError || !collateral) {
    throw new Error(collateralError?.message ?? "Failed to create sales brochure");
  }

  const agentProfile =
    agentProfileOverride ??
    (await loadListingAgentProfile(admin, listing)) ??
    agentProfileFromBrand(agency.id, tenant.brand);
  const agencyAgents =
    agencyAgentsOverride ?? (await loadAgencyAgentProfiles(admin, agency.id));

  const copy = await generateSalesBrochureCopy({
    agency: agency as Agency,
    listing,
  });

  const { provisionedListing, qrCodeUrl, qrTargetUrl } =
    await provisionCollateralQr({
      agency: agency as Agency,
      listing,
      collateral: collateral as CollateralItem,
      supabase: admin,
    });

  const built = buildSalesBrochureDocument({
    agency: agency as Agency,
    listing: provisionedListing,
    collateral: { ...(collateral as CollateralItem), template_id: templateId },
    copy,
    agentProfile,
    agencyAgents,
    resolvedAgents,
    qrCodeUrl,
    qrTargetUrl,
  });

  const documentJson = withBrochureContentSaved(built);
  const generatedAt = new Date().toISOString();

  const { data: generatedCollateral, error: generatedError } = await admin
    .from("collateral_items")
    .update({
      document_json: documentJson,
      template_id: templateId,
      status: "generated",
      generated_at: generatedAt,
    })
    .eq("id", collateral.id)
    .select("*")
    .single();

  if (generatedError || !generatedCollateral) {
    throw new Error(generatedError?.message ?? "Failed to save sales brochure document");
  }

  const publicSlug = generateCollateralSlug();
  const publicUrl = buildPublicCollateralUrl(agency.slug, publicSlug);
  const publishedDocument = withBrochureContentSaved({
    ...documentJson,
    assets: {
      ...documentJson.assets,
      qr_code_url: qrCodeUrl,
    },
  });

  const { data: publishedCollateral, error: publishError } = await admin
    .from("collateral_items")
    .update({
      public_slug: publicSlug,
      public_url: publicUrl,
      document_json: publishedDocument,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", collateral.id)
    .select("*")
    .single();

  if (publishError || !publishedCollateral) {
    throw new Error(publishError?.message ?? "Failed to publish sales brochure");
  }

  const template = getCollateralTemplate(templateId);
  const printUrl = `${getPrintRenderBaseUrl().replace(/\/$/, "")}/${agency.slug}/c/${publicSlug}/print`;

  const pdfBuffer = await renderPdfFromUrl(printUrl, {
    pageFormatId: template.pageFormat,
    mirrorImage: async (sourceUrl, buffer, contentType) => {
      const path = buildPdfImagePath(
        agency.id,
        collateral.id,
        sourceUrl,
        contentType,
      );
      const { error } = await admin.storage
        .from("report-assets")
        .upload(path, buffer, { contentType, upsert: true });
      if (error) return null;
      return admin.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
    },
    mirrorStylesheet: async (sourceUrl, buffer, contentType) => {
      const path = buildPdfStylesheetPath(agency.id, collateral.id, sourceUrl);
      const { error } = await admin.storage
        .from("report-assets")
        .upload(path, buffer, { contentType, upsert: true });
      if (error) return null;
      return admin.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
    },
  });

  const pdfPath = `${agency.id}/collateral/${collateral.id}.pdf`;
  const { error: pdfUploadError } = await admin.storage
    .from("report-pdfs")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (pdfUploadError) {
    throw new Error(pdfUploadError.message);
  }

  const { data: pdfPublic } = admin.storage.from("report-pdfs").getPublicUrl(pdfPath);
  const pdfUrl = cacheBustedPdfUrl(pdfPublic.publicUrl, Date.now());
  const syncedDocument = withBrochurePdfSynced(publishedDocument);

  await admin
    .from("collateral_items")
    .update({
      pdf_url: pdfUrl,
      document_json: syncedDocument,
    })
    .eq("id", collateral.id);

  const address =
    [listing.property_address, listing.suburb, listing.state]
      .filter(Boolean)
      .join(", ") || listing.property_address || "property";

  return {
    collateralId: collateral.id,
    listingId: listing.id,
    pdfBuffer,
    pdfUrl,
    publicUrl,
    pdfFilename: buildDeliverySalesBrochurePdfFilename({ tenant, address }),
    address,
  };
}
