import { NextResponse } from "next/server";
import { requireReportWithListing } from "@/lib/auth/requireUser";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, user, report } = await requireReportWithListing(id);

    const { data, error } = await supabase
      .from("reports")
      .insert({
        agency_id: agency.id,
        listing_id: report.listing_id,
        created_by: user.id,
        status: "draft",
        template_id: report.template_id,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ report: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Duplicate failed" },
      { status: 400 },
    );
  }
}
