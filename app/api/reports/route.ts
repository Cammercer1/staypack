import { NextResponse } from "next/server";
import { requireAgency, requireListingAccess } from "@/lib/auth/requireUser";
import { createStrAppraisal } from "@/lib/str-appraisals/service";
import { unstable_rethrow } from "next/navigation";
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
    unstable_rethrow(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load reports" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, agency } = await requireAgency();
    const body = createReportSchema.parse(await request.json());

    if (!body.listing_id) {
      return NextResponse.json(
        { error: "listing_id is required to create a report" },
        { status: 400 },
      );
    }

    const { listing } = await requireListingAccess(body.listing_id);


    const data = await createStrAppraisal({ supabase, agency, listing, requestId: crypto.randomUUID() });

    return NextResponse.json({ report: data });
  } catch (error) {
    unstable_rethrow(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create report" },
      { status: 400 },
    );
  }
}
