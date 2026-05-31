import { NextResponse } from "next/server";
import { findUnknownScrapedAgents } from "@/lib/agents/matchScrapedAgents";
import {
  requireAgency,
  requireListingAccess,
} from "@/lib/auth/requireUser";
import { scrapeListingSchema } from "@/lib/validation/schemas";
import { extractListingFromUrl } from "@/lib/scraping/extractListing";
import {
  ensureListingLandingProvisioned,
  generateListingSlug,
} from "@/lib/listings/provisionLandingPage";
import { mergeScrapeMasterSelection } from "@/lib/listings/collateralImages";
import { expandListingDescriptionAfterScrape } from "@/lib/listings/expandListingDescriptionAfterScrape";
import { detectListingPurpose } from "@/lib/listings/detectListingPurpose";
import { listingImageMetaForScrapeUpdate } from "@/lib/listings/syncListingImageMeta";
import type { Listing, ParsedListing } from "@/lib/types";

function buildScrapedListingFields(
  listingUrl: string,
  listing: ParsedListing,
  existing?: Partial<Listing>,
) {
  const master = mergeScrapeMasterSelection(
    {
      scraped_listing_json: listing,
      uploaded_image_urls: existing?.uploaded_image_urls ?? [],
    },
    existing
      ? {
          hero_image_url: existing.hero_image_url ?? null,
          selected_image_urls: existing.selected_image_urls ?? [],
        }
      : null,
  );

  return {
    listing_url: listingUrl,
    listing_purpose:
      existing?.listing_purpose ??
      detectListingPurpose({
        url: listingUrl,
        displayPrice: listing.displayPrice,
        aiPurpose: listing.purpose ?? null,
      }),
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
    hero_image_url: master.hero_image_url,
    selected_image_urls: master.selected_image_urls,
    scraped_listing_json: listing,
    listing_image_meta: listingImageMetaForScrapeUpdate(
      {
        scraped_listing_json: listing,
        uploaded_image_urls: existing?.uploaded_image_urls ?? [],
        listing_image_meta: existing?.listing_image_meta ?? {},
      },
      listing.images,
    ),
  };
}

async function applyExpandedListingDescription({
  supabase,
  listing,
  existingBeforeScrape,
  warnings,
}: {
  supabase: Awaited<ReturnType<typeof requireAgency>>["supabase"];
  listing: Listing;
  existingBeforeScrape?: Pick<
    Listing,
    "listing_description" | "scraped_listing_json"
  > | null;
  warnings: string[];
}) {
  try {
    const { description, expanded } = await expandListingDescriptionAfterScrape(
      listing,
      existingBeforeScrape,
    );

    if (!expanded || !description || description === listing.listing_description) {
      return listing;
    }

    const { data, error } = await supabase
      .from("listings")
      .update({ listing_description: description })
      .eq("id", listing.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Listing;
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Could not expand listing description: ${error.message}`
        : "Could not expand listing description automatically",
    );
    return listing;
  }
}

async function loadAgencyAgents(
  supabase: Awaited<ReturnType<typeof requireAgency>>["supabase"],
  agencyId: string,
) {
  const { data: agencyAgents, error: agentsError } = await supabase
    .from("agent_profiles")
    .select("*")
    .eq("agency_id", agencyId);

  if (agentsError) {
    throw new Error(agentsError.message);
  }

  return agencyAgents ?? [];
}

async function updateListingFromScrape({
  supabase,
  user,
  agency,
  listingId,
  listingUrl,
  parsedListing,
  method,
  parserName,
  warnings,
  existingListing,
}: {
  supabase: Awaited<ReturnType<typeof requireAgency>>["supabase"];
  user: Awaited<ReturnType<typeof requireAgency>>["user"];
  agency: Awaited<ReturnType<typeof requireAgency>>["agency"];
  listingId: string;
  listingUrl: string;
  parsedListing: ParsedListing;
  method: string;
  parserName: string;
  warnings: string[];
  existingListing: Listing;
}) {
  const { data: scrapeJob, error: scrapeError } = await supabase
    .from("scrape_jobs")
    .insert({
      agency_id: agency.id,
      listing_id: listingId,
      user_id: user.id,
      source_url: listingUrl,
      status: "success",
      method,
      parser_name: parserName,
      extracted_json: parsedListing,
      warnings,
    })
    .select("*")
    .single();

  if (scrapeError) {
    throw new Error(scrapeError.message);
  }

  const updateFields = buildScrapedListingFields(
    listingUrl,
    parsedListing,
    existingListing,
  );

  const { data: updatedListing, error: listingError } = await supabase
    .from("listings")
    .update(updateFields)
    .eq("id", listingId)
    .select("*")
    .single();

  if (listingError) {
    throw new Error(listingError.message);
  }

  const listingWithDescription = await applyExpandedListingDescription({
    supabase,
    listing: updatedListing as Listing,
    existingBeforeScrape: existingListing,
    warnings,
  });

  const agencyAgents = await loadAgencyAgents(supabase, agency.id);
  const unknown_agents = findUnknownScrapedAgents(
    parsedListing.agents,
    agencyAgents,
  );

  return {
    scrape_job_id: scrapeJob.id,
    method,
    parser_name: parserName,
    listing: listingWithDescription,
    scraped_listing: parsedListing,
    warnings,
    unknown_agents,
  };
}

export async function POST(request: Request) {
  // #region agent log
  const scrapeStartedAt = Date.now();
  // #endregion
  try {
    const body = scrapeListingSchema.parse(await request.json());
    // #region agent log
    fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H5',location:'scrape/route.ts:start',message:'scrape route started',data:{listingUrl:body.listing_url,hasListingId:Boolean(body.listing_id)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const extractStartedAt = Date.now();
    const { listing, method, parserName, warnings } = await extractListingFromUrl(
      body.listing_url,
    );
    // #region agent log
    fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H1',location:'scrape/route.ts:extractDone',message:'extractListingFromUrl complete',data:{method,parserName,extractMs:Date.now()-extractStartedAt,warningCount:warnings.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const scrapedFields = buildScrapedListingFields(body.listing_url, listing);

    if (!scrapedFields.property_address?.trim()) {
      return NextResponse.json(
        { error: "Could not extract a property address from this listing" },
        { status: 400 },
      );
    }

    if (body.listing_id) {
      const { supabase, user, agency, listing: existingListing } =
        await requireListingAccess(body.listing_id);

      const payload = await updateListingFromScrape({
        supabase,
        user,
        agency,
        listingId: existingListing.id,
        listingUrl: body.listing_url,
        parsedListing: listing,
        method,
        parserName,
        warnings,
        existingListing,
      });

      return NextResponse.json({
        ...payload,
        listing: await ensureListingLandingProvisioned(
          payload.listing as Listing,
          agency,
          supabase,
        ),
      });
    }

    const { supabase, user, agency } = await requireAgency();

    const { data: createdListing, error: listingInsertError } = await supabase
      .from("listings")
      .insert({
        agency_id: agency.id,
        created_by: user.id,
        status: "active",
        public_slug: generateListingSlug(),
        ...scrapedFields,
      })
      .select("*")
      .single();

    if (listingInsertError) {
      return NextResponse.json({ error: listingInsertError.message }, { status: 400 });
    }

    const { data: scrapeJob, error: scrapeError } = await supabase
      .from("scrape_jobs")
      .insert({
        agency_id: agency.id,
        listing_id: createdListing.id,
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

    const expandStartedAt = Date.now();
    const listingWithDescription = await applyExpandedListingDescription({
      supabase,
      listing: createdListing as Listing,
      existingBeforeScrape: null,
      warnings,
    });
    // #region agent log
    fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H2',location:'scrape/route.ts:expandDone',message:'description expansion complete',data:{expandMs:Date.now()-expandStartedAt,totalMsSoFar:Date.now()-scrapeStartedAt},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const agencyAgents = await loadAgencyAgents(supabase, agency.id);
    const unknown_agents = findUnknownScrapedAgents(listing.agents, agencyAgents);

    return NextResponse.json({
      scrape_job_id: scrapeJob.id,
      method,
      parser_name: parserName,
      listing: await ensureListingLandingProvisioned(
        listingWithDescription,
        agency,
        supabase,
      ),
      scraped_listing: listing,
      warnings,
      unknown_agents,
    });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55ff1d'},body:JSON.stringify({sessionId:'55ff1d',runId:'pre-fix',hypothesisId:'H5',location:'scrape/route.ts:error',message:'scrape route failed',data:{error:error instanceof Error?error.message:'unknown',totalMs:Date.now()-scrapeStartedAt},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 },
    );
  }
}
