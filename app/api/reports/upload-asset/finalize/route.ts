import { NextResponse } from "next/server";
import { requireListingAccess, requireReportWithListing } from "@/lib/auth/requireUser";
import { MAX_UPLOADED_IMAGES } from "@/lib/reports/constants";
import { dedupeImageUrls } from "@/lib/listings/dedupeImageUrls";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const reportId = String(body?.report_id ?? "");
    const listingId = String(body?.listing_id ?? "");
    const paths: string[] = Array.isArray(body?.paths)
      ? body.paths.filter((path: unknown): path is string => typeof path === "string")
      : [];

    if (!reportId && !listingId) {
      return NextResponse.json(
        { error: "Listing ID or report ID is required" },
        { status: 400 },
      );
    }

    if (paths.length === 0) {
      return NextResponse.json({ error: "No uploaded files to save" }, { status: 400 });
    }

    const { supabase, agency, listing } = reportId
      ? await requireReportWithListing(reportId)
      : await requireListingAccess(listingId);

    const prefix = `${agency.id}/${listing.id}/`;
    const bucket = supabase.storage.from("report-assets");
    const newUrls: string[] = [];

    for (const path of paths) {
      if (!path.startsWith(prefix)) {
        return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
      }

      const {
        data: { publicUrl },
      } = bucket.getPublicUrl(path);
      newUrls.push(publicUrl);
    }

    const existingUploads = listing.uploaded_image_urls ?? [];
    const uploadedImageUrls = dedupeImageUrls([...existingUploads, ...newUrls]).slice(
      0,
      MAX_UPLOADED_IMAGES,
    );

    const { error: updateError } = await supabase
      .from("listings")
      .update({ uploaded_image_urls: uploadedImageUrls })
      .eq("id", listing.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ uploaded_image_urls: uploadedImageUrls });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save uploads" },
      { status: 400 },
    );
  }
}
