import { NextResponse } from "next/server";
import { requireAgency, requireListingAccess } from "@/lib/auth/requireUser";
import { enrichListingRentalAppraisal } from "@/lib/rental/enrichListingRentalAppraisal";
import { resolveRentalDisplayPrice } from "@/lib/rental/formatRentalDisplayPrice";
import { extractListingFromUrl } from "@/lib/scraping/extractListing";
import { z } from "zod";

export const maxDuration = 300;

const bodySchema = z.object({
  listingId: z.string().uuid().optional(),
  url: z.string().url().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide listingId or url" },
      { status: 400 },
    );
  }

  const { listingId, url } = parsed.data;

  if (!listingId && !url) {
    return NextResponse.json(
      { error: "Provide listingId or url" },
      { status: 400 },
    );
  }

  try {
    if (url) {
      await requireAgency();
      const extracted = await extractListingFromUrl(url, {
        enrichRentalAppraisal: true,
      });

      return NextResponse.json({
        listing: extracted.listing,
        displayPrice: resolveRentalDisplayPrice(extracted.listing),
        warnings: extracted.warnings,
        method: extracted.method,
        parserName: extracted.parserName,
      });
    }

    const { supabase, listing } = await requireListingAccess(listingId!);
    const scraped = listing.scraped_listing_json;

    if (!scraped) {
      return NextResponse.json(
        { error: "Listing has no scraped data. Scrape the listing URL first." },
        { status: 400 },
      );
    }

    const enriched = await enrichListingRentalAppraisal(scraped);
    const displayPrice = resolveRentalDisplayPrice(enriched);

    const { data: updated, error } = await supabase
      .from("listings")
      .update({
        scraped_listing_json: enriched,
        display_price: displayPrice ?? listing.display_price,
        listing_purpose: "lease",
      })
      .eq("id", listing.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      listing: enriched,
      displayPrice,
      savedListing: updated,
      warnings: enriched.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Rental appraisal failed",
      },
      { status: 500 },
    );
  }
}
