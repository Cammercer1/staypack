import { NextResponse } from "next/server";
import { findUnknownScrapedAgents } from "@/lib/agents/matchScrapedAgents";
import { requireAgency, requireReportAccess } from "@/lib/auth/requireUser";
import { scrapeListingSchema } from "@/lib/validation/schemas";
import { extractListingFromUrl } from "@/lib/scraping/extractListing";
import type { ParsedListing } from "@/lib/types";

function buildScrapedReportFields(
  listingUrl: string,
  listing: ParsedListing,
  existing?: {
    property_address: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    property_type: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    car_spaces: number | null;
    listing_title: string | null;
    listing_description: string | null;
    display_price: string | null;
    hero_image_url: string | null;
  },
) {
  return {
    listing_url: listingUrl,
    property_address: listing.address ?? existing?.property_address ?? null,
    suburb: listing.suburb ?? existing?.suburb ?? null,
    state: listing.state ?? existing?.state ?? null,
    postcode: listing.postcode ?? existing?.postcode ?? null,
    property_type: listing.propertyType ?? existing?.property_type ?? null,
    bedrooms: listing.bedrooms ?? existing?.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? existing?.bathrooms ?? null,
    car_spaces: listing.carSpaces ?? existing?.car_spaces ?? null,
    listing_title: listing.title ?? existing?.listing_title ?? null,
    listing_description: listing.description ?? existing?.listing_description ?? null,
    display_price: listing.displayPrice ?? existing?.display_price ?? null,
    hero_image_url: listing.images[0] ?? existing?.hero_image_url ?? null,
    selected_image_urls: listing.images[0] ? [listing.images[0]] : [],
    scraped_listing_json: listing,
    status: "scraped" as const,
  };
}

export async function POST(request: Request) {
  try {
    const body = scrapeListingSchema.parse(await request.json());
    const { listing, method, parserName, warnings } = await extractListingFromUrl(
      body.listing_url,
    );

    const scrapedFields = buildScrapedReportFields(body.listing_url, listing);

    if (!scrapedFields.property_address?.trim()) {
      return NextResponse.json(
        { error: "Could not extract a property address from this listing" },
        { status: 400 },
      );
    }

    if (body.report_id) {
      const { supabase, user, agency, report } = await requireReportAccess(
        body.report_id,
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

      const updateFields = buildScrapedReportFields(body.listing_url, listing, report);

      const { data: updatedReport, error: reportError } = await supabase
        .from("reports")
        .update(updateFields)
        .eq("id", report.id)
        .select("*")
        .single();

      if (reportError) {
        return NextResponse.json({ error: reportError.message }, { status: 400 });
      }

      const { data: agencyAgents, error: agentsError } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("agency_id", agency.id);

      if (agentsError) {
        return NextResponse.json({ error: agentsError.message }, { status: 400 });
      }

      const unknown_agents = findUnknownScrapedAgents(
        listing.agents,
        agencyAgents ?? [],
      );

      return NextResponse.json({
        scrape_job_id: scrapeJob.id,
        method,
        parser_name: parserName,
        listing,
        warnings,
        unknown_agents,
        report: updatedReport,
      });
    }

    const { supabase, user, agency } = await requireAgency();

    const { data: report, error: insertError } = await supabase
      .from("reports")
      .insert({
        agency_id: agency.id,
        created_by: user.id,
        ...scrapedFields,
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

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

    const { data: agencyAgents, error: agentsError } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("agency_id", agency.id);

    if (agentsError) {
      return NextResponse.json({ error: agentsError.message }, { status: 400 });
    }

    const unknown_agents = findUnknownScrapedAgents(
      listing.agents,
      agencyAgents ?? [],
    );

    return NextResponse.json({
      scrape_job_id: scrapeJob.id,
      method,
      parser_name: parserName,
      listing,
      warnings,
      unknown_agents,
      report,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 },
    );
  }
}
