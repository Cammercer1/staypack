import { createAdminClient } from "@/lib/supabase/admin";
import { getReportsUrl } from "@/lib/env";
import { renderPdfFromUrl, buildPdfImagePath, buildPdfStylesheetPath } from "@/lib/browserless/pdf";
import { buildLeaseAppraisalReport } from "@/lib/lease-appraisal/buildLeaseAppraisalReport";
import { generateLeaseAppraisalCopy } from "@/lib/openai/generateLeaseAppraisalCopy";
import { rentAppraisalTierSetting } from "@/lib/delivery/rentAppraisalConfig";
import { enrichListingRentalAppraisal } from "@/lib/rental/enrichListingRentalAppraisal";
import { applyTemplateBrandToFinalReport } from "@/lib/reports/applyTemplateBrand";
import { cacheBustedPdfUrl } from "@/lib/reports/cacheBustedPdfUrl";
import { buildPublicReportUrl, generateReportSlug } from "@/lib/reports/slugs";
import { HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { resolveDeliveryAgency } from "@/lib/delivery/brand/ensureShadowAgency";
import { agentProfileFromBrand } from "@/lib/delivery/brand/agentFromBrand";
import { buildDeliveryLeaseAppraisalPdfFilename } from "@/lib/delivery/reports/pdfFilename";
import {
  buildListingInsertFromParsed,
} from "@/lib/delivery/str/buildListingFromScrape";
import { generateListingSlug } from "@/lib/listings/provisionLandingPage";
import type { DeliveryTenant } from "@/lib/delivery/types";
import type { Agency, Listing, ParsedListing, Report } from "@/lib/types";

export type HeadlessLeaseAppraisalResult = {
  reportId: string;
  listingId: string;
  pdfBuffer: Buffer;
  pdfUrl: string;
  publicUrl: string;
  pdfFilename: string;
  address: string;
};

export async function generateHeadlessLeaseAppraisal({
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
}): Promise<HeadlessLeaseAppraisalResult> {
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

  const enriched =
    parsed.rentalAppraisal?.weeklyMin != null
      ? parsed
      : await enrichListingRentalAppraisal(parsed, {
          rentAppraisalConfig: {
            tier: rentAppraisalTierSetting(tenant) ?? "auto",
          },
        });

  let listing: Listing;

  if (existingListing) {
    listing = existingListing;
  } else {
    const listingFields = buildListingInsertFromParsed(listingUrl, enriched);

    const { data: createdListing, error: listingError } = await admin
      .from("listings")
      .insert({
        agency_id: agency.id,
        status: "active",
        public_slug: generateListingSlug(),
        ...listingFields,
        scraped_listing_json: enriched,
      })
      .select("*")
      .single();

    if (listingError || !createdListing) {
      throw new Error(listingError?.message ?? "Failed to create listing");
    }

    listing = createdListing as Listing;
  }
  const templateId =
    tenant.brand?.report_template_id ?? HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID;

  const { data: report, error: reportError } = await admin
    .from("reports")
    .insert({
      agency_id: agency.id,
      listing_id: listing.id,
      status: "draft",
      template_id: templateId,
    })
    .select("*")
    .single();

  if (reportError || !report) {
    throw new Error(reportError?.message ?? "Failed to create report");
  }

  const agentProfile = agentProfileFromBrand(agency.id, tenant.brand);

  const { ltrEnrichmentFromParsed } = await import(
    "@/lib/lease-appraisal/ltrEnrichmentFromParsed"
  );
  const ltrEnrichment = ltrEnrichmentFromParsed(enriched);

  const copy = await generateLeaseAppraisalCopy({
    agency: agency as Agency,
    listing: {
      ...listing,
      listing_description:
        listing.listing_description ?? enriched.description ?? null,
      listing_title: listing.listing_title ?? enriched.title ?? null,
    },
    parsed: enriched,
    compCount: enriched.rentalAppraisal?.compCount ?? ltrEnrichment?.comp_count ?? 0,
    weeklyMin: enriched.rentalAppraisal?.weeklyMin ?? null,
    weeklyMax: enriched.rentalAppraisal?.weeklyMax ?? null,
    suburbMarket: enriched.ltrSuburbMarket ?? ltrEnrichment?.suburb_market ?? null,
    featuredComps: ltrEnrichment?.comps ?? [],
  });

  const finalReportJson = applyTemplateBrandToFinalReport(
    buildLeaseAppraisalReport({
      agency: agency as Agency,
      listing,
      report: report as Report,
      parsed: enriched,
      agentProfile,
      templateId,
      copy,
    }),
  );

  const publicSlug = generateReportSlug();
  const publicUrl = buildPublicReportUrl(
    getReportsUrl(),
    agency.slug,
    publicSlug,
  );

  const { data: publishedReport, error: publishError } = await admin
    .from("reports")
    .update({
      template_id: templateId,
      final_report_json: finalReportJson,
      status: "published",
      public_slug: publicSlug,
      public_url: publicUrl,
      generated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (publishError || !publishedReport) {
    throw new Error(publishError?.message ?? "Failed to publish lease appraisal report");
  }

  const printUrl = `${getReportsUrl().replace(/\/$/, "")}/${agency.slug}/${publicSlug}/print`;

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

  const pdfPath = `${agency.id}/${report.id}/lease-appraisal.pdf`;
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
        ...finalReportJson,
        assets: {
          ...finalReportJson.assets,
          pdf_url: pdfUrl,
        },
      },
    })
    .eq("id", report.id);

  const address =
    [listing.property_address, listing.suburb, listing.state]
      .filter(Boolean)
      .join(", ") || parsed.address!;

  const pdfFilename = buildDeliveryLeaseAppraisalPdfFilename({ tenant, address });

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
