import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { createCollateralSchema } from "@/lib/validation/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, listing } = await requireListingAccess(id);

    const { data, error } = await supabase
      .from("collateral_items")
      .select("*")
      .eq("listing_id", listing.id)
      .neq("status", "archived")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ collateral: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load collateral",
      },
      { status: 400 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, listing } = await requireListingAccess(id);
    const body = createCollateralSchema.parse(await request.json());

    if (body.type === "str_report") {
      return NextResponse.json(
        { error: "Use the STR report flow to create an STR report" },
        { status: 400 },
      );
    }

    const photoError = collateralPhotoRequirementError(listing);
    if (photoError) {
      return NextResponse.json({ error: photoError }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("collateral_items")
      .insert({
        listing_id: listing.id,
        agency_id: agency.id,
        type: body.type,
        status: "draft",
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This collateral type already exists for the listing" },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ collateral: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create collateral",
      },
      { status: 400 },
    );
  }
}
