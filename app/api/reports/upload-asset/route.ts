import { NextResponse } from "next/server";
import { requireListingAccess, requireReportWithListing } from "@/lib/auth/requireUser";
import { MAX_UPLOADED_IMAGES } from "@/lib/reports/constants";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const reportId = String(formData.get("report_id") ?? "");
    const listingId = String(formData.get("listing_id") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!reportId && !listingId) {
      return NextResponse.json(
        { error: "Listing ID or report ID is required" },
        { status: 400 },
      );
    }

    const { supabase, agency, listing } = reportId
      ? await requireReportWithListing(reportId)
      : await requireListingAccess(listingId);

    const existingUploads = listing.uploaded_image_urls ?? [];

    if (existingUploads.length >= MAX_UPLOADED_IMAGES) {
      return NextResponse.json(
        { error: `You can upload up to ${MAX_UPLOADED_IMAGES} photos per listing` },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Image must be PNG, JPG, WEBP or AVIF" },
        { status: 400 },
      );
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${agency.id}/${listing.id}/${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage.from("report-assets").upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("report-assets").getPublicUrl(path);

    const uploadedImageUrls = [...existingUploads, publicUrl];
    const { error: updateError } = await supabase
      .from("listings")
      .update({ uploaded_image_urls: uploadedImageUrls })
      .eq("id", listing.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      url: publicUrl,
      path,
      uploaded_image_urls: uploadedImageUrls,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
