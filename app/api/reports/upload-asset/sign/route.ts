import { NextResponse } from "next/server";
import { requireListingAccess, requireReportWithListing } from "@/lib/auth/requireUser";
import { MAX_UPLOADED_IMAGES } from "@/lib/reports/constants";
import { z } from "zod";
import { usesR2Storage } from "@/lib/storage/r2";
import { signR2ImageUpload } from "@/lib/storage/signedUpload";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
];

const signSchema = z.object({
  report_id: z.string().optional(), listing_id: z.string().optional(),
  storage_protocol: z.literal(2).optional(),
  files: z.array(z.object({ name: z.string().optional(), type: z.string(), size: z.number().int().positive().optional() })).min(1).max(MAX_UPLOADED_IMAGES),
});

export async function POST(request: Request) {
  try {
    const body = signSchema.parse(await request.json());
    const reportId = String(body?.report_id ?? "");
    const listingId = String(body?.listing_id ?? "");
    const files = body.files;

    if (!reportId && !listingId) {
      return NextResponse.json(
        { error: "Listing ID or report ID is required" },
        { status: 400 },
      );
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    for (const file of files) {
      if (!file?.type || !ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Image must be PNG, JPG, WEBP or AVIF" },
          { status: 400 },
        );
      }
    }

    const { supabase, agency, listing } = reportId
      ? await requireReportWithListing(reportId)
      : await requireListingAccess(listingId);

    const existingUploads = listing.uploaded_image_urls ?? [];
    const slotsRemaining = MAX_UPLOADED_IMAGES - existingUploads.length;

    if (slotsRemaining <= 0) {
      return NextResponse.json(
        { error: `You can upload up to ${MAX_UPLOADED_IMAGES} photos per listing` },
        { status: 400 },
      );
    }

    if (files.length > slotsRemaining) {
      return NextResponse.json(
        {
          error: `Only ${slotsRemaining} upload slot${slotsRemaining === 1 ? "" : "s"} remaining`,
        },
        { status: 400 },
      );
    }

    const bucket = supabase.storage.from("report-assets");

    const uploads = await Promise.all(
      files.map(async (file) => {
        const extension =
          (file.name?.split(".").pop()?.toLowerCase() ?? "").replace(/[^a-z0-9]/g, "") ||
          "jpg";
        const path = `${agency.id}/${listing.id}/${crypto.randomUUID()}.${extension}`;
        // Older open browser sessions can finish their Supabase upload protocol.
        if (body.storage_protocol === 2 && usesR2Storage()) {
          return signR2ImageUpload(path, file.type, file.size ?? 0);
        }
        const { data, error } = await bucket.createSignedUploadUrl(path);

        if (error || !data) {
          throw new Error(error?.message ?? "Failed to create upload URL");
        }

        const {
          data: { publicUrl },
        } = bucket.getPublicUrl(path);

        return { provider: "supabase", path, token: data.token, signedUrl: data.signedUrl, publicUrl };
      }),
    );

    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare upload" },
      { status: 400 },
    );
  }
}
