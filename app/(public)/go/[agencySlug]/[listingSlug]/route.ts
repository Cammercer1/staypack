import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { buildListingQrRedirectDestination } from "@/lib/listings/listingUrls";
import { recordListingPageView } from "@/lib/listings/pageViews";

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

  const admin = createAdminClient();

  const { data: agency } = await admin
    .from("agencies")
    .select("id")
    .eq("slug", agencySlug)
    .maybeSingle();

  if (!agency) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: listing } = await admin
    .from("listings")
    .select("id, custom_landing_url, public_url, status")
    .eq("agency_id", agency.id)
    .eq("public_slug", listingSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const destination = buildListingQrRedirectDestination(listing);
  if (!destination) {
    return NextResponse.json({ error: "Listing page not available" }, { status: 404 });
  }

  await recordListingPageView({
    listingId: listing.id,
    source: "qr",
    referrer: request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.redirect(destination, 302);
}
