import { NextResponse } from "next/server";
import { requireListingAccess, requireReportWithListing } from "@/lib/auth/requireUser";
import { MAX_UPLOADED_IMAGES } from "@/lib/reports/constants";
import { dedupeImageUrls } from "@/lib/listings/dedupeImageUrls";
import { z } from "zod";
import { verifyR2ImageUpload } from "@/lib/storage/signedUpload";

const finalizeSchema = z.object({
  report_id: z.string().optional(), listing_id: z.string().optional(),
  paths: z.array(z.string()).max(MAX_UPLOADED_IMAGES).optional(),
  uploads: z.array(z.object({ path: z.string(), provider: z.enum(["supabase", "r2"]) })).max(MAX_UPLOADED_IMAGES).optional(),
});

export async function POST(request: Request) {
  try {
    const body = finalizeSchema.parse(await request.json());
    const reportId = String(body?.report_id ?? "");
    const listingId = String(body?.listing_id ?? "");
    const uploads = body.uploads ?? (body.paths ?? []).map(path => ({ path, provider: "supabase" as const }));

    if (!reportId && !listingId) {
      return NextResponse.json(
        { error: "Listing ID or report ID is required" },
        { status: 400 },
      );
    }

    if (uploads.length === 0) {
      return NextResponse.json({ error: "No uploaded files to save" }, { status: 400 });
    }

    const { supabase, agency, listing } = reportId
      ? await requireReportWithListing(reportId)
      : await requireListingAccess(listingId);

    const prefix = `${agency.id}/${listing.id}/`;
    const bucket = supabase.storage.from("report-assets");
    const newUrls: string[] = [];

    for (const { path, provider } of uploads) {
      if (!path.startsWith(prefix) || path.slice(prefix.length).includes("/") || /[\\\x00-\x1f]/.test(path)) {
        return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
      }

      if (provider === "r2") {
        newUrls.push(await verifyR2ImageUpload(path));
        continue;
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
