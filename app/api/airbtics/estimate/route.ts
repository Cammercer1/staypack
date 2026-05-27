import { NextResponse } from "next/server";
import { requireReportAccess } from "@/lib/auth/requireUser";
import { geocodeReportAddress } from "@/lib/geocoding";
import { airbticsEstimateSchema } from "@/lib/validation/schemas";
import { fetchAirbticsEstimate } from "@/lib/airbtics/client";
import { calculateAccommodates } from "@/lib/reports/formatters";

export async function POST(request: Request) {
  try {
    const body = airbticsEstimateSchema.parse(await request.json());
    const { supabase, report } = await requireReportAccess(body.report_id);

    let latitude =
      body.latitude != null ? Number(body.latitude) : report.latitude;
    let longitude =
      body.longitude != null ? Number(body.longitude) : report.longitude;
    let formattedAddress: string | null = null;

    if (latitude == null || longitude == null) {
      const geocoded = await geocodeReportAddress({
        property_address: body.address ?? report.property_address,
        suburb: report.suburb,
        state: report.state,
        postcode: report.postcode,
        country: report.country,
      });

      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      formattedAddress = geocoded.formattedAddress;
    }

    const bedrooms = Number(body.bedrooms ?? report.bedrooms ?? 2);
    const bathrooms = Number(body.bathrooms ?? report.bathrooms ?? 1);
    const accommodates = calculateAccommodates(
      bedrooms,
      body.accommodates ?? report.accommodates,
    );

    const result = await fetchAirbticsEstimate(
      {
        latitude,
        longitude,
        bedrooms,
        bathrooms,
        accommodates,
      },
      body.tier,
    );
    const { estimate, tier, reportId, costCents, enrichment } = result;

    const { data, error } = await supabase
      .from("reports")
      .update({
        latitude,
        longitude,
        bedrooms,
        bathrooms,
        accommodates,
        airbtics_tier: tier,
        airbtics_report_id: reportId,
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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ...estimate,
      tier,
      enrichment,
      annual_revenue: estimate.annualRevenue,
      monthly_revenue: estimate.monthlyRevenue,
      weekly_revenue: estimate.weeklyRevenue,
      nightly_rate: estimate.nightlyRate,
      occupancy_rate: estimate.occupancyRate,
      booked_nights: estimate.bookedNights,
      radius_m: estimate.radiusM,
      latitude,
      longitude,
      bedrooms,
      bathrooms,
      accommodates,
      formatted_address: formattedAddress,
      raw: estimate.raw,
      estimate,
      report: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Estimate failed" },
      { status: 400 },
    );
  }
}
