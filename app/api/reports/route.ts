import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth/requireUser";
import { createReportSchema } from "@/lib/validation/schemas";

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
    const body = createReportSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("reports")
      .insert({
        agency_id: agency.id,
        created_by: user.id,
        status: "draft",
        listing_url: body.listing_url ?? null,
        property_address: body.property_address ?? null,
        bedrooms: body.bedrooms ?? null,
        bathrooms: body.bathrooms ?? null,
        car_spaces: body.car_spaces ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ report: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create report" },
      { status: 400 },
    );
  }
}
