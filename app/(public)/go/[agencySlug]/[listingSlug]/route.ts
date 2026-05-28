import { NextResponse } from "next/server";
import { resolveAgencyBySlug } from "@/lib/agencies/resolveAgencyBySlug";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { buildListingQrRedirectDestination } from "@/lib/listings/listingUrls";
import { recordListingPageView } from "@/lib/listings/pageViews";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agencySlug: string; listingSlug: string }> },
) {
  const { agencySlug, listingSlug } = await params;

  // #region agent log
  fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a515ca",
    },
    body: JSON.stringify({
      sessionId: "a515ca",
      location: "go/route.ts:GET:entry",
      message: "QR redirect requested",
      data: { agencySlug, listingSlug, hasServiceRole: hasServiceRoleKey() },
      timestamp: Date.now(),
      hypothesisId: "H2-H4",
    }),
  }).catch(() => {});
  // #endregion

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  const agency = await resolveAgencyBySlug(admin, agencySlug);

  if (!agency) {
    // #region agent log
    fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "a515ca",
      },
      body: JSON.stringify({
        sessionId: "a515ca",
        location: "go/route.ts:GET:no-agency",
        message: "Agency not found",
        data: { agencySlug },
        timestamp: Date.now(),
        hypothesisId: "H2",
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: listing } = await admin
    .from("listings")
    .select("id, custom_landing_url, public_url, status, public_slug")
    .eq("agency_id", agency.id)
    .eq("public_slug", listingSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!listing) {
    const { data: listingAnyStatus } = await admin
      .from("listings")
      .select("id, status, public_slug")
      .eq("agency_id", agency.id)
      .eq("public_slug", listingSlug)
      .maybeSingle();
    // #region agent log
    fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "a515ca",
      },
      body: JSON.stringify({
        sessionId: "a515ca",
        location: "go/route.ts:GET:no-listing",
        message: "Active listing not found",
        data: {
          agencySlug,
          listingSlug,
          agencyId: agency.id,
          listingAnyStatus: listingAnyStatus ?? null,
        },
        timestamp: Date.now(),
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const destination = buildListingQrRedirectDestination(listing, agency.slug);
  if (!destination) {
    // #region agent log
    fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "a515ca",
      },
      body: JSON.stringify({
        sessionId: "a515ca",
        location: "go/route.ts:GET:no-destination",
        message: "No redirect destination",
        data: {
          listingId: listing.id,
          public_url: listing.public_url,
          custom_landing_url: listing.custom_landing_url,
        },
        timestamp: Date.now(),
        hypothesisId: "H4",
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({ error: "Listing page not available" }, { status: 404 });
  }

  // #region agent log
  fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a515ca",
    },
    body: JSON.stringify({
      sessionId: "a515ca",
      location: "go/route.ts:GET:redirect",
      message: "Redirecting",
      data: { destination, listingId: listing.id },
      timestamp: Date.now(),
      hypothesisId: "H4",
    }),
  }).catch(() => {});
  // #endregion

  await recordListingPageView({
    listingId: listing.id,
    source: "qr",
    referrer: request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.redirect(destination, 302);
}
