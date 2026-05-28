import { NextResponse } from "next/server";
import { requireAgency, requireListingAccess } from "@/lib/auth/requireUser";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { createReportSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const { supabase, agency } = await requireAgency();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const listingId = searchParams.get("listing_id");

    let query = supabase
      .from("reports")
      .select("*")
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false });

    if (listingId) {
      query = query.eq("listing_id", listingId);
    }

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
    const body = createReportSchema.parse(await request.json());

    if (!body.listing_id) {
      return NextResponse.json(
        { error: "listing_id is required to create a report" },
        { status: 400 },
      );
    }

    const { listing } = await requireListingAccess(body.listing_id);

    const photoError = collateralPhotoRequirementError(listing);
    if (photoError) {
      return NextResponse.json({ error: photoError }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("reports")
      .insert({
        agency_id: agency.id,
        listing_id: listing.id,
        created_by: user.id,
        status: "draft",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { error: collateralError } = await supabase
      .from("collateral_items")
      .insert({
        listing_id: listing.id,
        agency_id: agency.id,
        type: "str_report",
        status: "draft",
        report_id: data.id,
      });

    if (collateralError && collateralError.code !== "23505") {
      return NextResponse.json({ error: collateralError.message }, { status: 400 });
    }

    return NextResponse.json({ report: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create report" },
      { status: 400 },
    );
  }
}
