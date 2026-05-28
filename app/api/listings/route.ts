import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth/requireUser";
import { prepareListingInput } from "@/lib/listings/prepareListingInput";
import {
  ensureListingLandingProvisioned,
  generateListingSlug,
} from "@/lib/listings/provisionLandingPage";
import { createListingSchema } from "@/lib/validation/schemas";
import type { Report } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { supabase, agency } = await requireAgency();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("listings")
      .select("*, reports(*)")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    } else {
      query = query.neq("status", "archived");
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const listings = (data ?? []).map((row) => {
      const reports = Array.isArray(row.reports) ? row.reports : [];
      const { reports: _reports, ...listing } = row;
      return {
        ...listing,
        str_report: reports.find((report: Report) => report.status !== "archived") ?? reports[0] ?? null,
      };
    });

    return NextResponse.json({ listings });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load listings",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, agency, user } = await requireAgency();
    const body = createListingSchema.parse(await request.json());
    const { prepared, geocodeWarning } = await prepareListingInput(body);

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .insert({
        agency_id: agency.id,
        created_by: user.id,
        status: "active",
        agent_profile_id: prepared.agent_profile_id ?? null,
        listing_url: prepared.listing_url ?? null,
        property_address: prepared.property_address,
        suburb: prepared.suburb ?? null,
        state: prepared.state ?? null,
        postcode: prepared.postcode ?? null,
        country: prepared.country ?? "Australia",
        latitude: prepared.latitude ?? null,
        longitude: prepared.longitude ?? null,
        property_type: prepared.property_type ?? null,
        bedrooms: prepared.bedrooms ?? null,
        bathrooms: prepared.bathrooms ?? null,
        car_spaces: prepared.car_spaces ?? null,
        accommodates: prepared.accommodates ?? null,
        listing_title: prepared.listing_title ?? null,
        listing_description: prepared.listing_description ?? null,
        display_price: prepared.display_price ?? null,
        hero_image_url: prepared.hero_image_url ?? null,
        selected_image_urls: prepared.selected_image_urls ?? [],
        uploaded_image_urls: prepared.uploaded_image_urls ?? [],
        scraped_listing_json: prepared.scraped_listing_json ?? null,
        public_slug: generateListingSlug(),
      })
      .select("*")
      .single();

    if (listingError) {
      return NextResponse.json({ error: listingError.message }, { status: 400 });
    }

    const provisionedListing = await ensureListingLandingProvisioned(
      listing,
      agency,
      supabase,
    );

    return NextResponse.json({
      listing: provisionedListing,
      geocode_warning: geocodeWarning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create listing",
      },
      { status: 400 },
    );
  }
}
