import { NextResponse } from "next/server";
import { requireReportAccess } from "@/lib/auth/requireUser";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, user, report } = await requireReportAccess(id);

    const { data, error } = await supabase
      .from("reports")
      .insert({
        agency_id: agency.id,
        created_by: user.id,
        status: "draft",
        listing_url: report.listing_url,
        property_address: report.property_address,
        suburb: report.suburb,
        state: report.state,
        postcode: report.postcode,
        property_type: report.property_type,
        bedrooms: report.bedrooms,
        bathrooms: report.bathrooms,
        car_spaces: report.car_spaces,
        accommodates: report.accommodates,
        listing_title: report.listing_title,
        listing_description: report.listing_description,
        display_price: report.display_price,
        hero_image_url: report.hero_image_url,
        selected_image_urls: report.selected_image_urls,
        uploaded_image_urls: report.uploaded_image_urls,
        template_id: report.template_id,
        scraped_listing_json: report.scraped_listing_json,
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
