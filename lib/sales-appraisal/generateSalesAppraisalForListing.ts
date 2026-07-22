import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { buildSalesAppraisalReport } from "@/lib/sales-appraisal/buildSalesAppraisalReport";
import { DEFAULT_SALES_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/sales-appraisal/ids";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";
import { salesEnrichmentFromParsed } from "@/lib/sales-appraisal/salesEnrichmentFromParsed";
import { generateSalesAppraisalCopy } from "@/lib/openai/generateSalesAppraisalCopy";
import { hasSalesAppraisalSelectedComps } from "@/lib/sales-appraisal/salesAppraisalData";
import {
  completedSalesAppraisalEnrichmentStatus,
  salesAppraisalEnrichmentStatus,
  withSalesAppraisalEnrichmentStatus,
} from "@/lib/sales-appraisal/enrichmentStatus";
import { enrichParsedListingForSalesAppraisal } from "@/lib/sales-appraisal/enrichParsedListingForSalesAppraisal";
import { resolveAgentProfile } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import type {
  Agency,
  AgentProfile,
  Listing,
  ParsedListing,
  Report,
} from "@/lib/types";

export { DEFAULT_SALES_APPRAISAL_TEMPLATE_ID as SALES_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/sales-appraisal/ids";

function assertSaleListing(listing: Listing) {
  if (listing.listing_purpose === "lease") {
    throw new Error(
      "Property appraisals are only available for listings marked for sale",
    );
  }
}

function assertScrapedListing(listing: Listing) {
  if (!listing.scraped_listing_json) {
    throw new Error(
      "Import the listing URL first so we can find sold and for-sale comparables",
    );
  }
}

export function hasSalesAppraisalComps(parsed: ParsedListing | null | undefined) {
  const appraisal = parsed?.salesAppraisal;
  return Boolean(
    appraisal?.compCount != null &&
      appraisal.compCount > 0 &&
      (appraisal.priceMidpoint != null ||
        (appraisal.priceMin != null && appraisal.priceMax != null)),
  );
}

export async function createSalesAppraisalDraft({
  supabase,
  agency,
  listing,
  userId,
}: {
  supabase: SupabaseClient;
  agency: Agency;
  listing: Listing;
  userId?: string;
}): Promise<{ report: Report; listing: Listing }> {
  assertSaleListing(listing);
  assertScrapedListing(listing);

  const { data: existingCollateral } = await supabase
    .from("collateral_items")
    .select("report_id")
    .eq("listing_id", listing.id)
    .eq("type", "sales_appraisal")
    .neq("status", "archived")
    .maybeSingle();

  if (existingCollateral?.report_id) {
    const { data: existingReport } = await supabase
      .from("reports")
      .select("*")
      .eq("id", existingCollateral.report_id)
      .maybeSingle();

    if (existingReport) {
      return { report: existingReport as Report, listing };
    }
  }

  const { data: createdReport, error: reportError } = await supabase
    .from("reports")
    .insert({
      agency_id: agency.id,
      listing_id: listing.id,
      created_by: userId ?? null,
      status: "draft",
      template_id: null,
    })
    .select("*")
    .single();

  if (reportError || !createdReport) {
    throw new Error(reportError?.message ?? "Failed to create sales appraisal report");
  }

  const { error: collateralError } = await supabase.from("collateral_items").insert({
    listing_id: listing.id,
    agency_id: agency.id,
    type: "sales_appraisal",
    status: "draft",
    report_id: createdReport.id,
    template_id: null,
  });

  if (collateralError && collateralError.code !== "23505") {
    throw new Error(collateralError.message);
  }

  return { report: createdReport as Report, listing };
}

export async function enrichListingForSalesAppraisal({
  supabase,
  listing,
  requestId,
}: {
  supabase: SupabaseClient;
  listing: Listing;
  requestId?: string;
}): Promise<{ listing: Listing; parsed: ParsedListing; warnings: string[] }> {
  assertSaleListing(listing);
  assertScrapedListing(listing);

  const { parsed, warnings } = await enrichParsedListingForSalesAppraisal(
    listing.scraped_listing_json!,
    { subjectListingUrl: listing.listing_url },
  );
  const previousStatus = salesAppraisalEnrichmentStatus(
    listing.scraped_listing_json,
  );
  const enrichmentRequestId = requestId ?? previousStatus?.requestId ?? randomUUID();
  const completedParsed = withSalesAppraisalEnrichmentStatus(
    parsed,
    completedSalesAppraisalEnrichmentStatus(previousStatus, enrichmentRequestId),
  );

  const { data: updatedListing, error: listingError } = await supabase
    .from("listings")
    .update({ scraped_listing_json: completedParsed })
    .eq("id", listing.id)
    .select("*")
    .single();

  if (listingError || !updatedListing) {
    throw new Error(listingError?.message ?? "Failed to save sales appraisal data");
  }

  return {
    listing: updatedListing as Listing,
    parsed: completedParsed,
    warnings,
  };
}

export async function generateSalesAppraisalReportContent({
  supabase,
  agency,
  listing: initialListing,
  report,
  agencyAgents = [],
  templateId,
}: {
  supabase: SupabaseClient;
  agency: Agency;
  listing: Listing;
  report: Report;
  agencyAgents?: AgentProfile[];
  templateId?: string;
}): Promise<{ report: Report; listing: Listing; parsed: ParsedListing }> {
  assertSaleListing(initialListing);

  const listing = initialListing;

  const parsed = listing.scraped_listing_json;
  if (!parsed) {
    throw new Error("Import the listing URL before generating the appraisal");
  }

  if (!hasSalesAppraisalComps(parsed)) {
    throw new Error("Fetch sale comps before generating appraisal content");
  }

  if (!hasSalesAppraisalSelectedComps(parsed)) {
    throw new Error(
      "Select at least one comparable sale before generating content",
    );
  }

  const resolvedTemplateId =
    templateId ??
    (isSalesAppraisalTemplateId(report.template_id)
      ? report.template_id!
      : DEFAULT_SALES_APPRAISAL_TEMPLATE_ID);

  const agentProfile = resolveAgentProfile(listing, agencyAgents);
  const salesEnrichment = salesEnrichmentFromParsed(parsed);

  const copy = await generateSalesAppraisalCopy({
    agency,
    listing: {
      ...listing,
      listing_description: listing.listing_description ?? parsed.description ?? null,
      listing_title: listing.listing_title ?? parsed.title ?? null,
    },
    parsed,
    soldCompCount:
      parsed.salesAppraisal?.soldCompCount ??
      salesEnrichment?.sold_comp_count ??
      0,
    forSaleCompCount:
      parsed.salesAppraisal?.forSaleCompCount ??
      salesEnrichment?.for_sale_comp_count ??
      0,
    priceMin: parsed.salesAppraisal?.priceMin ?? null,
    priceMax: parsed.salesAppraisal?.priceMax ?? null,
    featuredComps: salesEnrichment?.comps ?? [],
  });

  const finalReportJson = resolveFinalReportForDisplay(
    buildSalesAppraisalReport({
      agency,
      listing,
      report,
      parsed,
      agentProfile,
      agencyAgents,
      templateId: resolvedTemplateId,
      copy,
    }),
    { templateId: resolvedTemplateId },
  );

  const preservePublished = report.status === "published";

  const { data: savedReport, error: saveError } = await supabase
    .from("reports")
    .update({
      template_id: resolvedTemplateId,
      final_report_json: finalReportJson,
      status: preservePublished ? report.status : "generated",
      generated_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (saveError || !savedReport) {
    throw new Error(saveError?.message ?? "Failed to save sales appraisal report");
  }

  await supabase
    .from("collateral_items")
    .update({
      status: preservePublished ? "published" : "generated",
      generated_at: new Date().toISOString(),
      template_id: resolvedTemplateId,
    })
    .eq("listing_id", listing.id)
    .eq("type", "sales_appraisal");

  return {
    report: savedReport as Report,
    listing,
    parsed,
  };
}
