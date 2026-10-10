import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { invalidateReportPdf, preserveReportImages } from "@/lib/reports/invalidateReportPdf";
import { finalReportCopyToAiCopy } from "@/lib/reports/editable/strReportCopyAdapter";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { NextResponse } from "next/server";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { geocodeReportAddress } from "@/lib/geocoding";
import { strEstimateSchema } from "@/lib/validation/schemas";
import { fetchStrEstimate } from "@/lib/str/estimate";
import { calculateAccommodates } from "@/lib/reports/formatters";
import { applyStrEstimateAdjustments, initialStrManagementScenario, readStrRateOverride, saveStrRateOverride } from "@/lib/reports/strEstimateAdjustments";
import { selectStrComps } from "@/lib/str/comparables";

// One calculator request, followed by cached or freshly fetched market history.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = strEstimateSchema.parse(await request.json());
    const { supabase, agency, report, listing } = await requireReportWithListing(body.report_id);

    let latitude =
      body.latitude != null ? Number(body.latitude) : listing.latitude;
    let longitude =
      body.longitude != null ? Number(body.longitude) : listing.longitude;
    let formattedAddress: string | null = null;

    if (latitude == null || longitude == null) {
      const geocoded = await geocodeReportAddress({
        property_address: body.address ?? listing.property_address,
        suburb: listing.suburb,
        state: listing.state,
        postcode: listing.postcode,
        country: listing.country,
      });

      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      formattedAddress = geocoded.formattedAddress;
    }

    const bedrooms = Number(body.bedrooms ?? listing.bedrooms ?? 2);
    const bathrooms = Number(body.bathrooms ?? listing.bathrooms ?? 1);
    const accommodates = calculateAccommodates(
      bedrooms,
      body.accommodates ?? listing.accommodates,
    );
    const { estimate, enrichment: freshEnrichment } = await fetchStrEstimate(
      { latitude, longitude, bedrooms, bathrooms, accommodates }, listing, report.str_enrichment_json,
    );
    const initialScenario = !report.original_estimate_json && !report.final_estimate_json && !report.final_report_json && !readStrRateOverride(report)
      ? initialStrManagementScenario(estimate, agency.str_management_presets) : null;
    const rates = readStrRateOverride(report) ?? initialScenario?.rates ?? null;
    const overrides = saveStrRateOverride(report.user_overrides_json, rates, initialScenario?.assumptions ?? report.user_overrides_json?.strManagement);
    const finalEstimate = rates ? applyStrEstimateAdjustments(estimate, rates) : estimate;
    const retainedIds = report.str_enrichment_json?.selected_comp_ids?.filter((id) =>
      (freshEnrichment.comp_pool ?? freshEnrichment.comps).some((comp) => comp.listing_id === id),
    );
    const enrichment = retainedIds?.length ? selectStrComps(freshEnrichment, retainedIds) : freshEnrichment;

    const { error: listingError } = await supabase
      .from("listings")
      .update({
        latitude,
        longitude,
        bedrooms,
        bathrooms,
        accommodates,
      })
      .eq("id", listing.id);

    if (listingError) {
      return NextResponse.json({ error: listingError.message }, { status: 400 });
    }

    const updatedProperty = { ...listing, latitude, longitude, bedrooms, bathrooms, accommodates };
    const savedCopy = report.ai_copy_json ?? (report.final_report_json ? finalReportCopyToAiCopy(report.final_report_json.copy, null) : null);
    const finalDocument = savedCopy ? buildFinalReportJson({
      agency,
      agentProfile: await loadListingAgentProfile(supabase, listing),
      agencyAgents: await loadAgencyAgentProfiles(supabase, agency.id),
      listing: updatedProperty,
      report: { ...report, original_estimate_json: estimate, user_overrides_json: overrides, str_enrichment_json: enrichment, raw_airbtics_json: null },
      estimate: finalEstimate,
      copy: savedCopy,
      propertyImages: preserveReportImages(report.final_report_json),
    }) : null;

    const { data, error } = await supabase
      .from("reports")
      .update({
        // Leave the historical tier untouched for databases that still require it.
        // str_enrichment_json.provider identifies the current estimate provider.
        airbtics_report_id: null,
        airbtics_cost_cents: null,
        airbtics_fetched_at: null,
        original_estimate_json: estimate,
        final_estimate_json: finalEstimate,
        user_overrides_json: { ...overrides, estimateInputs: { bedrooms, bathrooms, accommodates } },
        pdf_url: null,
        final_report_json: finalDocument ? invalidateReportPdf(finalDocument) : null,
        raw_airbtics_json: null,
        str_enrichment_json: enrichment,
        status: report.status === "published" ? "published" : "estimated",
      })
      .eq("id", report.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data: updatedListing } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listing.id)
      .single();

    return NextResponse.json({
      ...finalEstimate,
      tier: "full",
      enrichment,
      annual_revenue: finalEstimate.annualRevenue,
      monthly_revenue: finalEstimate.monthlyRevenue,
      weekly_revenue: finalEstimate.weeklyRevenue,
      nightly_rate: finalEstimate.nightlyRate,
      occupancy_rate: finalEstimate.occupancyRate,
      booked_nights: finalEstimate.bookedNights,
      radius_m: finalEstimate.radiusM,
      latitude,
      longitude,
      bedrooms,
      bathrooms,
      accommodates,
      formatted_address: formattedAddress,
      raw: estimate.raw,
      estimate: finalEstimate,
      report: data,
      listing: updatedListing,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Estimate failed" },
      { status: 400 },
    );
  }
}
