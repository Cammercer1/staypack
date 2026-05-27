import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth/requireUser";
import { geocodeReportAddress, hasGeocodableAddress } from "@/lib/geocoding";
import {
  createReportSchema,
  parsedListingSchema,
  type UpdateReportInput,
} from "@/lib/validation/schemas";

const ADDRESS_FIELDS = [
  "property_address",
  "suburb",
  "state",
  "postcode",
  "country",
] as const;

export async function GET(request: Request) {
  try {
    const { supabase, agency } = await requireAgency();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("reports")
      .select("*")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ reports: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load reports" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, agency, user } = await requireAgency();
    const body = createReportSchema.parse(await request.json()) as UpdateReportInput;

    if (body.listing_agents !== undefined) {
      const currentScraped = parsedListingSchema.parse({
        images: [],
        agents: [],
        confidence: "low",
        warnings: [],
      });
      const listingAgents = body.listing_agents
        .map((agent) => ({
          name: agent.name.trim(),
          email: agent.email?.trim() || undefined,
          phone: agent.phone?.trim() || undefined,
          role_title: agent.role_title?.trim() || undefined,
          photo_url: agent.photo_url?.trim() || undefined,
        }))
        .filter((agent) => agent.name);

      body.scraped_listing_json = {
        ...currentScraped,
        agents: listingAgents,
      };
      delete body.listing_agents;
    }

    let geocodeWarning: string | undefined;

    if (
      hasGeocodableAddress(body) &&
      (body.latitude == null || body.longitude == null)
    ) {
      try {
        const geocoded = await geocodeReportAddress(body);
        body.latitude = geocoded.latitude;
        body.longitude = geocoded.longitude;
      } catch (error) {
        geocodeWarning =
          error instanceof Error
            ? error.message
            : "Unable to geocode property address";
      }
    }

    const { data, error } = await supabase
      .from("reports")
      .insert({
        agency_id: agency.id,
        created_by: user.id,
        status: body.status ?? "scraped",
        listing_url: body.listing_url ?? null,
        property_address: body.property_address,
        suburb: body.suburb ?? null,
        state: body.state ?? null,
        postcode: body.postcode ?? null,
        country: body.country ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        property_type: body.property_type ?? null,
        bedrooms: body.bedrooms ?? null,
        bathrooms: body.bathrooms ?? null,
        car_spaces: body.car_spaces ?? null,
        accommodates: body.accommodates ?? null,
        listing_title: body.listing_title ?? null,
        listing_description: body.listing_description ?? null,
        display_price: body.display_price ?? null,
        hero_image_url: body.hero_image_url ?? null,
        selected_image_urls: body.selected_image_urls ?? [],
        uploaded_image_urls: body.uploaded_image_urls ?? [],
        scraped_listing_json: body.scraped_listing_json ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      report: data,
      geocode_warning: geocodeWarning,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create report" },
      { status: 400 },
    );
  }
}
