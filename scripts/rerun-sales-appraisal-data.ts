import { createAdminClient } from "@/lib/supabase/admin";
import { extractListingFromUrl } from "@/lib/scraping/extractListing";
import { mergeParsedListings } from "@/lib/scraping/mergeParsedListings";
import { enrichListingForSalesAppraisal } from "@/lib/sales-appraisal/enrichListingForSalesAppraisal";
import { buildSalesAppraisalReport } from "@/lib/sales-appraisal/buildSalesAppraisalReport";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { enrichSelectedSaleCompDetails } from "@/lib/sales/enrichSaleCompDetails";
import { formatSalePriceRange } from "@/lib/sales/computeSalePriceBand";
import { deriveSalesAppraisalCopy } from "@/lib/sales-appraisal/deriveSalesAppraisalCopy";
import { salesEnrichmentFromParsed } from "@/lib/sales-appraisal/salesEnrichmentFromParsed";
import {
  loadAgencyAgentProfiles,
  loadListingAgentProfile,
} from "@/lib/reports/loadReportAgent";
import { DEFAULT_SALES_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/sales-appraisal/ids";
import type {
  Agency,
  FinalReportJson,
  Listing,
  Report,
} from "@/lib/types";

function requiredArgument(index: number, label: string) {
  const value = process.argv[index]?.trim();
  if (!value) {
    throw new Error(`Usage: tsx scripts/rerun-sales-appraisal-data.ts <${label}> [report-id]`);
  }
  return value;
}

function replacePriceRange(text: string, nextRange: string) {
  if (!nextRange) return text;
  return text.replace(
    /\$[\d,]+(?:\.\d+)?\s*(?:–|-|to)\s*\$[\d,]+(?:\.\d+)?/gi,
    nextRange,
  );
}

async function loadReport(admin: ReturnType<typeof createAdminClient>, listingId: string, reportId?: string) {
  if (reportId) {
    const { data, error } = await admin
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .eq("listing_id", listingId)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Report not found");
    return data as Report;
  }

  const { data: collateral, error: collateralError } = await admin
    .from("collateral_items")
    .select("report_id")
    .eq("listing_id", listingId)
    .eq("type", "sales_appraisal")
    .neq("status", "archived")
    .maybeSingle();
  if (collateralError) throw new Error(collateralError.message);
  if (!collateral?.report_id) throw new Error("No sales appraisal report found for listing");

  const { data, error } = await admin
    .from("reports")
    .select("*")
    .eq("id", collateral.report_id)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Report not found");
  return data as Report;
}

async function main() {
  const listingId = requiredArgument(2, "listing-id");
  const reportId = process.argv[3]?.startsWith("--")
    ? undefined
    : process.argv[3]?.trim() || undefined;
  const detailsOnly = process.argv.includes("--details-only");
  const reportOnly = process.argv.includes("--report-only");
  const admin = createAdminClient();

  const { data: listingRow, error: listingError } = await admin
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();
  if (listingError || !listingRow) {
    throw new Error(listingError?.message ?? "Listing not found");
  }

  const listing = listingRow as Listing;
  if (!listing.listing_url) throw new Error("Listing has no source URL");
  if (!listing.scraped_listing_json) throw new Error("Listing has no scraped JSON");

  const report = await loadReport(admin, listing.id, reportId);
  const { data: agencyRow, error: agencyError } = await admin
    .from("agencies")
    .select("*")
    .eq("id", listing.agency_id)
    .single();
  if (agencyError || !agencyRow) throw new Error(agencyError?.message ?? "Agency not found");
  const agency = agencyRow as Agency;

  const freshScrape = detailsOnly || reportOnly
    ? null
    : await extractListingFromUrl(listing.listing_url);
  let mergedParsed = freshScrape
    ? mergeParsedListings(listing.scraped_listing_json, freshScrape.listing)
    : listing.scraped_listing_json;

  if (detailsOnly) {
    const selectedIds = mergedParsed.salesAppraisal?.selectedCompListingIds ?? [];
    mergedParsed = {
      ...mergedParsed,
      salesComps: await enrichSelectedSaleCompDetails(
        mergedParsed.salesComps ?? [],
        selectedIds,
      ),
    };
  }

  const { data: scrapedListingRow, error: scrapeSaveError } = await admin
    .from("listings")
    .update({ scraped_listing_json: mergedParsed })
    .eq("id", listing.id)
    .select("*")
    .single();
  if (scrapeSaveError || !scrapedListingRow) {
    throw new Error(scrapeSaveError?.message ?? "Failed to save refreshed listing scrape");
  }

  const enriched = detailsOnly || reportOnly
    ? {
        listing: scrapedListingRow as Listing,
        parsed: mergedParsed,
        warnings: [] as string[],
      }
    : await enrichListingForSalesAppraisal({
        supabase: admin,
        listing: scrapedListingRow as Listing,
      });

  const existingFinal = report.final_report_json as FinalReportJson | null;
  const agencyAgents = await loadAgencyAgentProfiles(admin, agency.id);
  const agentProfile = await loadListingAgentProfile(admin, enriched.listing);
  const templateId =
    report.template_id ??
    existingFinal?.template_id ??
    DEFAULT_SALES_APPRAISAL_TEMPLATE_ID;
  const salesEnrichment = salesEnrichmentFromParsed(enriched.parsed);
  const priceMin = enriched.parsed.salesAppraisal?.priceMin ?? null;
  const priceMax = enriched.parsed.salesAppraisal?.priceMax ?? null;
  const nextRange =
    priceMin != null && priceMax != null
      ? formatSalePriceRange(priceMin, priceMax)
      : "";
  const derivedCopy = deriveSalesAppraisalCopy({
    agency,
    listing: enriched.listing,
    parsed: enriched.parsed,
    soldCompCount: salesEnrichment?.sold_comp_count ?? 0,
    forSaleCompCount: salesEnrichment?.for_sale_comp_count ?? 0,
    priceMin,
    priceMax,
    featuredComps: salesEnrichment?.comps ?? [],
  });
  const preservedCopy = existingFinal
    ? {
        ...existingFinal.copy,
        blurb: replacePriceRange(existingFinal.copy.blurb, nextRange),
        blurb_variants: existingFinal.copy.blurb_variants
          ? {
              short: replacePriceRange(
                existingFinal.copy.blurb_variants.short,
                nextRange,
              ),
              medium: replacePriceRange(
                existingFinal.copy.blurb_variants.medium,
                nextRange,
              ),
              long: replacePriceRange(
                existingFinal.copy.blurb_variants.long,
                nextRange,
              ),
            }
          : undefined,
        comparable_evidence: derivedCopy.comparable_evidence,
        methodology_note: derivedCopy.methodology_note,
      }
    : undefined;

  const rebuilt = buildSalesAppraisalReport({
    agency,
    listing: enriched.listing,
    report,
    parsed: enriched.parsed,
    agentProfile,
    agencyAgents,
    templateId,
    copy: preservedCopy,
    propertyImages: existingFinal
      ? {
          hero_image_url: existingFinal.property.hero_image_url,
          selected_image_urls: existingFinal.property.selected_image_urls,
        }
      : undefined,
    resolvedAgents: existingFinal?.agents,
  });
  const finalReportJson = resolveFinalReportForDisplay(rebuilt, { templateId });
  const generatedAt = new Date().toISOString();

  const { data: savedReportRow, error: reportSaveError } = await admin
    .from("reports")
    .update({
      final_report_json: finalReportJson,
      generated_at: generatedAt,
    })
    .eq("id", report.id)
    .select("*")
    .single();
  if (reportSaveError || !savedReportRow) {
    throw new Error(reportSaveError?.message ?? "Failed to save rebuilt report JSON");
  }

  await admin
    .from("collateral_items")
    .update({ generated_at: generatedAt })
    .eq("listing_id", listing.id)
    .eq("type", "sales_appraisal");

  const comps = finalReportJson.sales_enrichment?.comps ?? [];
  console.log(
    JSON.stringify(
      {
        listing_id: listing.id,
        report_id: report.id,
        scrape_method:
          freshScrape?.method ?? (reportOnly ? "report_rebuild" : "detail_refresh"),
        parser_name:
          freshScrape?.parserName ??
          (reportOnly ? "existing_scraped_data" : "featured_comparable_details"),
        subject: {
          sold_date: enriched.parsed.soldDate ?? null,
          land_area_sqm: enriched.parsed.landAreaSqm ?? null,
          floor_area_sqm: enriched.parsed.floorAreaSqm ?? null,
        },
        comparables: {
          total: comps.length,
          with_sold_date: comps.filter((comp) => Boolean(comp.sold_date)).length,
          with_land_area: comps.filter((comp) => comp.land_area_sqm != null).length,
          with_floor_area: comps.filter((comp) => comp.floor_area_sqm != null).length,
          with_property_type: comps.filter((comp) => Boolean(comp.property_type)).length,
          with_car_spaces: comps.filter((comp) => comp.car_spaces != null).length,
          records: comps.map((comp) => ({
            name: comp.name,
            status: comp.sale_status,
            sold_date: comp.sold_date,
            land_area_sqm: comp.land_area_sqm ?? null,
            floor_area_sqm: comp.floor_area_sqm ?? null,
            property_type: comp.property_type ?? null,
            car_spaces: comp.car_spaces ?? null,
          })),
        },
        warnings: enriched.warnings,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
