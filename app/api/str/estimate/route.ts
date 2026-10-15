import { estimateForCalculatorReview, calculatorPropertyReviewKey } from "@/lib/str-calculator/propertyReview";
import { calculatorLeadAddress } from "@/lib/str-calculator/leadAddress";
import { canonicalCalculatorSourceKey, loadCanonicalCalculatorLead } from "@/lib/str-calculator/leadCanonicalProperty";
import { assertPropertyCountry } from "@/lib/property-market/agencyCountry";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { invalidateReportPdf, preserveReportImages } from "@/lib/reports/invalidateReportPdf";
import { preservePublishedReport } from "@/lib/reports/publicationSnapshot";
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

    assertPropertyCountry(agency, listing);
    if (report.status === "archived" || listing.status === "archived") return NextResponse.json({ error: "Restore this appraisal before continuing." }, { status: 409 });
    const review = report.user_overrides_json?.calculatorReview;
    if (review?.status === "pending" && !body.confirm_calculator_property) return NextResponse.json({ error: "Confirm the property details before continuing." }, { status: 409 });
    let sourceKey = review?.propertyKey;
    if (body.confirm_calculator_property && sourceKey !== calculatorPropertyReviewKey(listing)) {
      const lead = await loadCanonicalCalculatorLead(agency.id, report.id);
      if (!lead && !sourceKey) return NextResponse.json({ error: "Calculator enquiry not found for this appraisal." }, { status: 400 });
      if (lead) sourceKey = canonicalCalculatorSourceKey(lead, report) ?? sourceKey
        ?? calculatorPropertyReviewKey({ ...calculatorLeadAddress(lead.address, lead.country), country: lead.country });
    }

    let latitude =
      !body.confirm_calculator_property && body.latitude != null ? Number(body.latitude) : listing.latitude;
    let longitude =
      !body.confirm_calculator_property && body.longitude != null ? Number(body.longitude) : listing.longitude;
    let formattedAddress: string | null = null;

    if (latitude == null || longitude == null) {
      const geocoded = await geocodeReportAddress({
        property_address: body.confirm_calculator_property ? listing.property_address : body.address ?? listing.property_address,
        suburb: listing.suburb,
        state: listing.state,
        postcode: listing.postcode,
        country: listing.country,
      });
      if (geocoded.placeId === "mock-place-id") {
        throw new Error("A real property location is required before requesting an estimate. Configure address lookup and try again.");
      }

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
    const estimateInput = { latitude, longitude, bedrooms, bathrooms, accommodates };
    const result = body.confirm_calculator_property && sourceKey
      ? await estimateForCalculatorReview(estimateInput, listing, report, sourceKey)
      : { ...await fetchStrEstimate(estimateInput, listing, report.str_enrichment_json), reused: false };
    const { estimate, enrichment: freshEnrichment } = result;
    const initialScenario = !report.original_estimate_json && !report.final_estimate_json && !report.final_report_json && !readStrRateOverride(report)
      ? initialStrManagementScenario(estimate, agency.str_management_presets) : null;
    const rates = readStrRateOverride(report) ?? initialScenario?.rates ?? null;
    const overrides = saveStrRateOverride(report.user_overrides_json, rates, initialScenario?.assumptions ?? report.user_overrides_json?.strManagement);
    if (body.confirm_calculator_property) overrides.calculatorReview = {
      status: "verified", propertyKey: calculatorPropertyReviewKey(listing), verifiedAt: new Date().toISOString(),
    };
    const finalEstimate = rates ? applyStrEstimateAdjustments(estimate, rates) : estimate;
    const retainedIds = report.str_enrichment_json?.selected_comp_ids?.filter((id) =>
      (freshEnrichment.comp_pool ?? freshEnrichment.comps).some((comp) => comp.listing_id === id),
    );
    const enrichment = !result.reused && retainedIds?.length ? selectStrComps(freshEnrichment, retainedIds) : freshEnrichment;

    const { data: savedListing, error: listingError } = await supabase
      .from("listings")
      .update({
        latitude,
        longitude,
        bedrooms,
        bathrooms,
        accommodates,
      })
      .eq("id", listing.id).eq("agency_id", agency.id).eq("updated_at", listing.updated_at).select("*").maybeSingle();

    if (!savedListing && !listingError) return NextResponse.json({ error: "The property changed while evidence was loading. Reload and confirm the latest details." }, { status: 409 });
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
        pdf_url: body.confirm_calculator_property && report.status === "published" ? report.pdf_url : null,
        final_report_json: body.confirm_calculator_property && report.status === "published" ? report.final_report_json : finalDocument ? preservePublishedReport(report, invalidateReportPdf(finalDocument)) : null,
        raw_airbtics_json: null,
        str_enrichment_json: enrichment,
        status: report.status === "published" ? "published" : "estimated",
      })
      .eq("id", report.id).eq("agency_id", agency.id).eq("updated_at", report.updated_at)
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
