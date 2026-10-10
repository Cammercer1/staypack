import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { invalidateReportPdf, preserveReportImages } from "@/lib/reports/invalidateReportPdf";
import { finalReportCopyToAiCopy } from "@/lib/reports/editable/strReportCopyAdapter";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { NextResponse } from "next/server";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { geocodeReportAddress } from "@/lib/geocoding";
import { airbticsEstimateSchema } from "@/lib/validation/schemas";
import { fetchAirbticsEstimate } from "@/lib/airbtics/client";
import { DEFAULT_AIRBTICS_TIER } from "@/lib/airbtics/constants";
import { positionStrEstimate } from "@/lib/airbtics/positionEstimate";
import { calculateAccommodates } from "@/lib/reports/formatters";

// Full-tier Airbtics polling (~30s) + comp positioning LLM call.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = airbticsEstimateSchema.parse(await request.json());
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
    const estimateTier = DEFAULT_AIRBTICS_TIER;

    const result = await fetchAirbticsEstimate(
      {
        latitude,
        longitude,
        bedrooms,
        bathrooms,
        accommodates,
      },
      estimateTier,
    );
    const { estimate, tier, reportId, costCents, enrichment } = result;
    const scrapedListing = listing.scraped_listing_json;

    // Position the subject within the comp distribution from the full Airbtics response.
    const { estimate: positionedEstimate, positioning } =
      await positionStrEstimate({
        subject: {
          property_address:
            listing.property_address ?? scrapedListing?.address ?? null,
          suburb: listing.suburb,
          state: listing.state,
          property_type:
            listing.property_type ?? scrapedListing?.propertyType ?? null,
          bedrooms,
          bathrooms,
          listing_title: listing.listing_title ?? scrapedListing?.title ?? null,
          listing_description:
            listing.listing_description ?? scrapedListing?.description ?? null,
          display_price: listing.display_price,
        },
        estimate,
      });

    const enrichmentWithPositioning = enrichment
      ? { ...enrichment, positioning }
      : enrichment;

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
      report: { ...report, str_enrichment_json: enrichmentWithPositioning, raw_airbtics_json: estimate.raw },
      estimate: positionedEstimate,
      copy: savedCopy,
      propertyImages: preserveReportImages(report.final_report_json),
    }) : null;

    const { data, error } = await supabase
      .from("reports")
      .update({
        airbtics_tier: tier,
        airbtics_report_id: reportId,
        airbtics_cost_cents: costCents,
        airbtics_fetched_at: new Date().toISOString(),
        original_estimate_json: estimate,
        final_estimate_json: positionedEstimate,
        user_overrides_json: { estimateInputs: { bedrooms, bathrooms, accommodates } },
        pdf_url: null,
        final_report_json: finalDocument ? invalidateReportPdf(finalDocument) : null,
        raw_airbtics_json: estimate.raw,
        str_enrichment_json: enrichmentWithPositioning,
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
      ...positionedEstimate,
      tier,
      enrichment: enrichmentWithPositioning,
      positioning,
      annual_revenue: positionedEstimate.annualRevenue,
      monthly_revenue: positionedEstimate.monthlyRevenue,
      weekly_revenue: positionedEstimate.weeklyRevenue,
      nightly_rate: positionedEstimate.nightlyRate,
      occupancy_rate: positionedEstimate.occupancyRate,
      booked_nights: positionedEstimate.bookedNights,
      radius_m: positionedEstimate.radiusM,
      latitude,
      longitude,
      bedrooms,
      bathrooms,
      accommodates,
      formatted_address: formattedAddress,
      raw: estimate.raw,
      estimate: positionedEstimate,
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
