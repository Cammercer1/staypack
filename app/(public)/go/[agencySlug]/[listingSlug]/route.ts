import { NextResponse } from "next/server";
import { resolveAgencyBySlug } from "@/lib/agencies/resolveAgencyBySlug";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey, isDevelopment } from "@/lib/env";
import { buildListingQrRedirectDestination } from "@/lib/listings/listingUrls";
import { recordListingPageView } from "@/lib/listings/pageViews";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agencySlug: string; listingSlug: string }> },
) {
  const { agencySlug, listingSlug } = await params;

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 503 },
    );
  }

  try {
    const admin = createAdminClient();
    const agency = await resolveAgencyBySlug(admin, agencySlug);

    if (!agency) {
      return NextResponse.json({ error: "Not found", code: "agency" }, { status: 404 });
    }

    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("*")
      .eq("agency_id", agency.id)
      .eq("public_slug", listingSlug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (listingError) {
      console.error("[go] listing query failed", listingError.message);
      return NextResponse.json(
        {
          error: "Server error",
          code: "listing_query",
          ...(isDevelopment() ? { detail: listingError.message } : {}),
        },
        { status: 500 },
      );
    }

    if (!listing) {
      return NextResponse.json({ error: "Not found", code: "listing" }, { status: 404 });
    }

    const destination = buildListingQrRedirectDestination(listing, agency.slug);
    if (!destination) {
      return NextResponse.json(
        { error: "Listing page not available", code: "destination" },
        { status: 404 },
      );
    }

    try {
      await recordListingPageView({
        listingId: listing.id,
        source: "qr",
        referrer: request.headers.get("referer"),
        userAgent: request.headers.get("user-agent"),
      });
    } catch (trackError) {
      console.error("[go] track view failed", trackError);
    }

    return NextResponse.redirect(destination, 302);
  } catch (error) {
    console.error("[go] unhandled error", error);
    return NextResponse.json({ error: "Server error", code: "unhandled" }, { status: 500 });
  }
}
