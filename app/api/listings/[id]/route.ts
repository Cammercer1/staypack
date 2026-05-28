import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { prepareListingPatch } from "@/lib/listings/prepareListingInput";
import { ensureListingLandingProvisioned } from "@/lib/listings/provisionLandingPage";
import { updateListingSchema } from "@/lib/validation/schemas";
import type { Listing } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, listing } = await requireListingAccess(id);

    const { data: reports, error } = await supabase
      .from("reports")
      .select("*")
      .eq("listing_id", listing.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      listing,
      str_report: reports?.[0] ?? null,
      reports: reports ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load listing",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, listing } = await requireListingAccess(id);
    const body = updateListingSchema.parse(await request.json());
    const { prepared, geocodeWarning } = await prepareListingPatch(body, listing);

    const { data, error } = await supabase
      .from("listings")
      .update(prepared)
      .eq("id", listing.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const provisionedListing = await ensureListingLandingProvisioned(
      data as Listing,
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
          error instanceof Error ? error.message : "Unable to update listing",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, listing } = await requireListingAccess(id);

    const { error } = await supabase
      .from("listings")
      .update({ status: "archived" })
      .eq("id", listing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to delete listing",
      },
      { status: 400 },
    );
  }
}
