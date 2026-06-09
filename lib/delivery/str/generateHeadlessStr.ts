import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAirbticsEstimate } from "@/lib/airbtics/client";
import { geocodeReportAddress } from "@/lib/geocoding";
import { getPrintRenderBaseUrl, getReportsUrl } from "@/lib/env";
import { renderPdfFromUrl, buildPdfImagePath, buildPdfStylesheetPath } from "@/lib/browserless/pdf";
import { ensureListingLandingProvisioned } from "@/lib/listings/provisionLandingPage";
import { generateListingSlug } from "@/lib/listings/provisionLandingPage";
import {
  buildListingQrTrackingUrl,
  resolveListingDestinationUrl,
} from "@/lib/listings/listingUrls";
import { generateReportCopy } from "@/lib/openai/generateReportCopy";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { cacheBustedPdfUrl } from "@/lib/reports/cacheBustedPdfUrl";
import { buildPublicReportUrl, generateReportSlug } from "@/lib/reports/slugs";
import { generateQrCodeBuffer } from "@/lib/reports/qr";
import { resolveReportTemplateId } from "@/lib/reports/templates/resolveTemplateId";
import { reportTemplateIdFromAirbticsTier } from "@/lib/reports/templateFromEstimateTier";
import { resolveDeliveryAgency } from "@/lib/delivery/brand/ensureShadowAgency";
import { agentProfileFromBrand } from "@/lib/delivery/brand/agentFromBrand";
import { buildDeliveryStrReportPdfFilename } from "@/lib/delivery/reports/pdfFilename";
import { templateIdFromPack } from "@/lib/delivery/template-packs";
import {
  assertListingReadyForStr,
  buildListingInsertFromParsed,
} from "@/lib/delivery/str/buildListingFromScrape";
import type { DeliveryTenant } from "@/lib/delivery/types";
import type { Agency, Listing, ParsedListing, Report } from "@/lib/types";

export type HeadlessStrResult = {
  reportId: string;
  listingId: string;
  pdfBuffer: Buffer;
  pdfUrl: string;
  publicUrl: string;
  /** Email attachment / local save name (e.g. havenly-property-str-report-…). */
  pdfFilename: string;
  address: string;
};

export async function generateHeadlessStrReport({
  tenant,
  listingUrl,
  parsed,
  listing: existingListing,
  agency: existingAgency,
}: {
  tenant: DeliveryTenant;
  listingUrl: string;
  parsed: ParsedListing;
  listing?: Listing;
  agency?: Agency;
}): Promise<HeadlessStrResult> {
  if (!parsed.address?.trim()) {
    throw new Error("Scraped listing is missing a property address");
  }

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

  let listing: Listing;

  if (existingListing) {
    listing = existingListing;
  } else {
    const listingFields = buildListingInsertFromParsed(listingUrl, parsed);

    const { data: createdListing, error: listingError } = await admin
      .from("listings")
      .insert({
        agency_id: agency.id,
        status: "active",
        public_slug: generateListingSlug(),
        ...listingFields,
      })
      .select("*")
      .single();

    if (listingError || !createdListing) {
      throw new Error(listingError?.message ?? "Failed to create listing");
    }

    listing = createdListing as Listing;
  }

  assertListingReadyForStr(listing);

  if (listing.listing_purpose === "lease") {
    throw new Error("STR reports are only available for listings for sale");
  }

  const packTemplateId =
    tenant.brand?.report_template_id ??
    templateIdFromPack(tenant.str_template_pack_id);

  const { data: report, error: reportError } = await admin
    .from("reports")
    .insert({
      agency_id: agency.id,
      listing_id: listing.id,
      status: "draft",
      template_id: packTemplateId,
    })
    .select("*")
    .single();

  if (reportError || !report) {
    throw new Error(reportError?.message ?? "Failed to create report");
  }

  const { error: collateralError } = await admin.from("collateral_items").insert({
    listing_id: listing.id,
    agency_id: agency.id,
    type: "str_report",
    status: "draft",
    report_id: report.id,
  });

  if (collateralError && collateralError.code !== "23505") {
    throw new Error(collateralError.message);
  }

  const geocoded = await geocodeReportAddress({
    property_address: listing.property_address,
    suburb: listing.suburb,
    state: listing.state,
    postcode: listing.postcode,
    country: listing.country,
  });

  const bedrooms = Number(listing.bedrooms ?? 2);
  const bathrooms = Number(listing.bathrooms ?? 1);
  const accommodates = Math.max(bedrooms * 2, 2);

  const estimateResult = await fetchAirbticsEstimate(
    {
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      bedrooms,
      bathrooms,
      accommodates,
    },
    "full",
  );

  const { estimate, tier, reportId: airbticsReportId, costCents, enrichment } =
    estimateResult;

  const templateId =
    packTemplateId ||
    reportTemplateIdFromAirbticsTier(tier) ||
    resolveReportTemplateId(agency as Agency, report as Report);

  await admin
    .from("listings")
    .update({
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      bedrooms,
      bathrooms,
      accommodates,
    })
    .eq("id", listing.id);

  const { data: estimatedReport, error: estimateDbError } = await admin
    .from("reports")
    .update({
      airbtics_tier: tier,
      template_id: templateId,
      airbtics_report_id: airbticsReportId,
      airbtics_cost_cents: costCents,
      airbtics_fetched_at: new Date().toISOString(),
      original_estimate_json: estimate,
      final_estimate_json: estimate,
      raw_airbtics_json: estimate.raw,
      str_enrichment_json: enrichment,
      status: "estimated",
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (estimateDbError || !estimatedReport) {
    throw new Error(estimateDbError?.message ?? "Failed to save estimate");
  }

  const { data: refreshedListing } = await admin
    .from("listings")
    .select("*")
    .eq("id", listing.id)
    .single();

  listing = (refreshedListing ?? listing) as Listing;

  const reportForCopy = estimatedReport as Report;
  const agentProfile =
    (await loadListingAgentProfile(admin, listing)) ??
    agentProfileFromBrand(agency.id, tenant.brand);
  const agencyAgents = await loadAgencyAgentProfiles(admin, agency.id);
  const copy = await generateReportCopy({
    agency: agency as Agency,
    listing,
    report: reportForCopy,
    estimate,
  });

  const finalReportJson = resolveFinalReportForDisplay(
    buildFinalReportJson({
      agency: agency as Agency,
      agentProfile,
      agencyAgents,
      listing,
      report: { ...reportForCopy, template_id: templateId },
      estimate,
      copy,
      scraped: listing.scraped_listing_json,
    }),
    { templateId },
  );

  const { data: generatedReport, error: generatedError } = await admin
    .from("reports")
    .update({
      template_id: templateId,
      ai_copy_json: copy,
      final_report_json: finalReportJson,
      status: "generated",
      generated_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (generatedError || !generatedReport) {
    throw new Error(generatedError?.message ?? "Failed to generate report copy");
  }

  listing = await ensureListingLandingProvisioned(
    listing,
    agency as Agency,
    admin,
  );

  const publicSlug = generateReportSlug();
  const publicUrl = buildPublicReportUrl(
    getReportsUrl(),
    agency.slug,
    publicSlug,
  );

  const qrTrackingUrl = buildListingQrTrackingUrl(
    agency.slug,
    listing.public_slug!,
  );
  const qrDestinationUrl = resolveListingDestinationUrl(listing);

  if (!qrDestinationUrl) {
    throw new Error("Listing landing page is not provisioned");
  }

  const qrBuffer = await generateQrCodeBuffer(qrTrackingUrl);
  const qrPath = `${agency.id}/${report.id}/qr-${Date.now()}.png`;

  const { error: qrUploadError } = await admin.storage
    .from("report-assets")
    .upload(qrPath, qrBuffer, { contentType: "image/png", upsert: true });

  if (qrUploadError) {
    throw new Error(qrUploadError.message);
  }

  const { data: qrPublic } = admin.storage.from("report-assets").getPublicUrl(qrPath);

  const publishedFinalJson = {
    ...(finalReportJson as Record<string, unknown>),
    assets: {
      ...((finalReportJson as { assets?: Record<string, string> }).assets ?? {}),
      qr_code_url: qrPublic.publicUrl,
    },
  };

  const { data: publishedReport, error: publishError } = await admin
    .from("reports")
    .update({
      public_slug: publicSlug,
      public_url: publicUrl,
      qr_code_url: qrPublic.publicUrl,
      final_report_json: publishedFinalJson,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (publishError || !publishedReport) {
    throw new Error(publishError?.message ?? "Failed to publish report");
  }

  await admin
    .from("collateral_items")
    .update({ status: "published" })
    .eq("report_id", report.id);

  const printUrl = `${getPrintRenderBaseUrl().replace(/\/$/, "")}/${agency.slug}/${publicSlug}/print`;

  const pdfBuffer = await renderPdfFromUrl(printUrl, {
    mirrorImage: async (sourceUrl, buffer, contentType) => {
      const path = buildPdfImagePath(agency.id, report.id, sourceUrl, contentType);
      const { error } = await admin.storage
        .from("report-assets")
        .upload(path, buffer, { contentType, upsert: true });
      if (error) return null;
      return admin.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
    },
    mirrorStylesheet: async (sourceUrl, buffer, contentType) => {
      const path = buildPdfStylesheetPath(agency.id, report.id, sourceUrl);
      const { error } = await admin.storage
        .from("report-assets")
        .upload(path, buffer, { contentType, upsert: true });
      if (error) return null;
      return admin.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
    },
  });

  const pdfPath = `${agency.id}/${report.id}/delivery-report.pdf`;
  const { error: pdfUploadError } = await admin.storage
    .from("report-pdfs")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (pdfUploadError) {
    throw new Error(pdfUploadError.message);
  }

  const { data: pdfPublic } = admin.storage.from("report-pdfs").getPublicUrl(pdfPath);
  const pdfUrl = cacheBustedPdfUrl(pdfPublic.publicUrl, Date.now());

  await admin
    .from("reports")
    .update({
      pdf_url: pdfUrl,
      final_report_json: {
        ...publishedFinalJson,
        assets: {
          ...(publishedFinalJson.assets as Record<string, string>),
          pdf_url: pdfUrl,
        },
      },
    })
    .eq("id", report.id);

  const address =
    [listing.property_address, listing.suburb, listing.state]
      .filter(Boolean)
      .join(", ") || parsed.address!;

  const pdfFilename = buildDeliveryStrReportPdfFilename({ tenant, address });

  return {
    reportId: report.id,
    listingId: listing.id,
    pdfBuffer,
    pdfUrl,
    publicUrl,
    pdfFilename,
    address,
  };
}
