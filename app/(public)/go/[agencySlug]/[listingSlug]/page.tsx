import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { resolveAgencyBySlug } from "@/lib/agencies/resolveAgencyBySlug";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { buildListingQrRedirectDestination } from "@/lib/listings/listingUrls";
import { recordListingPageView } from "@/lib/listings/pageViews";

export const dynamic = "force-dynamic";

/** QR scan entry — same data path as public listing pages, then redirect. */
export default async function ListingQrRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; listingSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { agencySlug, listingSlug } = await params;
  const query = await searchParams;

  // #region agent log
  fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a515ca",
    },
    body: JSON.stringify({
      sessionId: "a515ca",
      location: "go/page.tsx:entry",
      message: "QR redirect page",
      data: {
        agencySlug,
        listingSlug,
        hasServiceRole: hasServiceRoleKey(),
      },
      timestamp: Date.now(),
      hypothesisId: "H7",
      runId: "post-fix",
    }),
  }).catch(() => {});
  // #endregion

  if (!hasServiceRoleKey()) {
    notFound();
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
        location: "go/page.tsx:no-agency",
        message: "Agency not found",
        data: { agencySlug },
        timestamp: Date.now(),
        hypothesisId: "H2",
        runId: "post-fix",
      }),
    }).catch(() => {});
    // #endregion
    notFound();
  }

  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id, custom_landing_url, public_url, status, public_slug")
    .eq("agency_id", agency.id)
    .eq("public_slug", listingSlug)
    .eq("status", "active")
    .maybeSingle();

  if (listingError) {
    throw new Error(listingError.message);
  }

  if (!listing) {
    // #region agent log
    fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "a515ca",
      },
      body: JSON.stringify({
        sessionId: "a515ca",
        location: "go/page.tsx:no-listing",
        message: "Listing not found",
        data: { agencySlug, listingSlug, agencyId: agency.id, listingError: null },
        timestamp: Date.now(),
        hypothesisId: "H3",
        runId: "post-fix",
      }),
    }).catch(() => {});
    // #endregion
    notFound();
  }

  const destination = buildListingQrRedirectDestination(listing, agency.slug);
  if (!destination) {
    notFound();
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
      location: "go/page.tsx:redirect",
      message: "Redirecting",
      data: { destination, listingId: listing.id },
      timestamp: Date.now(),
      hypothesisId: "H7",
      runId: "post-fix",
    }),
  }).catch(() => {});
  // #endregion

  const referrer =
    typeof query.ref === "string"
      ? query.ref
      : typeof query.referrer === "string"
        ? query.referrer
        : null;

  const headerList = await headers();

  await recordListingPageView({
    listingId: listing.id,
    source: "qr",
    referrer: referrer ?? headerList.get("referer"),
    userAgent: headerList.get("user-agent"),
  });

  redirect(destination);
}
