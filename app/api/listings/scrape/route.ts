import { NextResponse } from "next/server";
import { requireReportAccess } from "@/lib/auth/requireUser";
import { scrapeListingSchema } from "@/lib/validation/schemas";
import { extractListingFromUrl } from "@/lib/scraping/extractListing";

export async function POST(request: Request) {
  try {
    const body = scrapeListingSchema.parse(await request.json());
    const { supabase, user, agency, report } = await requireReportAccess(
      body.report_id,
    );

    const { listing, method, parserName, warnings } = await extractListingFromUrl(
      body.listing_url,
    );

    const { data: scrapeJob, error: scrapeError } = await supabase
      .from("scrape_jobs")
      .insert({
        agency_id: agency.id,
        report_id: report.id,
        user_id: user.id,
        source_url: body.listing_url,
        status: "success",
        method,
        parser_name: parserName,
        extracted_json: listing,
        warnings,
      })
      .select("*")
      .single();

    if (scrapeError) {
      return NextResponse.json({ error: scrapeError.message }, { status: 400 });
    }

    const { data: updatedReport, error: reportError } = await supabase
      .from("reports")
      .update({
        listing_url: body.listing_url,
        property_address: listing.address ?? report.property_address,
        suburb: listing.suburb ?? report.suburb,
        state: listing.state ?? report.state,
        postcode: listing.postcode ?? report.postcode,
        property_type: listing.propertyType ?? report.property_type,
        bedrooms: listing.bedrooms ?? report.bedrooms,
        bathrooms: listing.bathrooms ?? report.bathrooms,
        car_spaces: listing.carSpaces ?? report.car_spaces,
        listing_title: listing.title ?? report.listing_title,
        listing_description: listing.description ?? report.listing_description,
        display_price: listing.displayPrice ?? report.display_price,
        hero_image_url: listing.images[0] ?? report.hero_image_url,
        selected_image_urls: listing.images[0] ? [listing.images[0]] : [],
        scraped_listing_json: listing,
        status: "scraped",
      })
      .eq("id", report.id)
      .select("*")
      .single();

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 400 });
    }

    return NextResponse.json({
      scrape_job_id: scrapeJob.id,
      method,
      parser_name: parserName,
      listing,
      warnings,
      report: updatedReport,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 },
    );
  }
}
