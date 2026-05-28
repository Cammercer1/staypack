import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildListingQrTrackingUrl,
  buildPublicListingUrl,
} from "@/lib/listings/listingUrls";
import { getSiteUrl } from "@/lib/env";
import { generateQrCodeBuffer } from "@/lib/reports/qr";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, public_slug, agency_id")
    .eq("id", id)
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (!listing.public_slug) {
    return NextResponse.json(
      { error: "Listing has no public slug yet — publish the landing page first" },
      { status: 400 },
    );
  }

  const { data: agency, error: agencyErr } = await supabase
    .from("agencies")
    .select("id, slug")
    .eq("id", listing.agency_id)
    .single();

  if (agencyErr || !agency) {
    return NextResponse.json({ error: "Agency not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const trackingUrl = buildListingQrTrackingUrl(agency.slug, listing.public_slug);
  const publicUrl = buildPublicListingUrl(agency.slug, listing.public_slug);
  // #region agent log
  fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a515ca",
    },
    body: JSON.stringify({
      sessionId: "a515ca",
      location: "regenerate-qr/route.ts:POST",
      message: "Regenerating QR",
      data: {
        listingId: listing.id,
        trackingUrl,
        publicUrl,
        siteUrl: getSiteUrl(),
      },
      timestamp: Date.now(),
      hypothesisId: "H1-H5",
    }),
  }).catch(() => {});
  // #endregion
  const qrBuffer = await generateQrCodeBuffer(trackingUrl);
  const qrPath = `${agency.id}/${listing.id}/landing-qr.png`;

  const { error: uploadError } = await admin.storage
    .from("report-assets")
    .upload(qrPath, qrBuffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl: landingQrCodeUrl },
  } = admin.storage.from("report-assets").getPublicUrl(qrPath);

  const { error: updateError } = await supabase
    .from("listings")
    .update({
      landing_qr_code_url: landingQrCodeUrl,
      public_url: publicUrl,
    })
    .eq("id", listing.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ landing_qr_code_url: landingQrCodeUrl });
}
