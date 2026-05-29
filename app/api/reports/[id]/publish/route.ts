import { NextResponse } from "next/server";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportsUrl } from "@/lib/env";
import { ensureListingLandingProvisioned } from "@/lib/listings/provisionLandingPage";
import {
  buildListingQrTrackingUrl,
  resolveListingDestinationUrl,
} from "@/lib/listings/listingUrls";
import {
  buildPublicReportUrl,
  generateReportSlug,
} from "@/lib/reports/slugs";
import { generateQrCodeBuffer } from "@/lib/reports/qr";
import type { Listing } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, report, listing } = await requireReportWithListing(id);

    if (!report.final_report_json) {
      return NextResponse.json(
        { error: "Generate collateral before publishing" },
        { status: 400 },
      );
    }

    const provisionedListing = await ensureListingLandingProvisioned(
      listing as Listing,
      agency,
      supabase,
    );

    const publicSlug = report.public_slug ?? generateReportSlug();
    const publicUrl = buildPublicReportUrl(
      getReportsUrl(),
      agency.slug,
      publicSlug,
    );

    const qrTrackingUrl = buildListingQrTrackingUrl(
      agency.slug,
      provisionedListing.public_slug!,
    );
    const qrDestinationUrl = resolveListingDestinationUrl(provisionedListing);
    const admin = createAdminClient();
    let qrPublicUrl: string | null = null;

    if (!qrDestinationUrl) {
      return NextResponse.json(
        { error: "Listing landing page is not provisioned" },
        { status: 400 },
      );
    }

    const qrBuffer = await generateQrCodeBuffer(qrTrackingUrl);
    const qrVersion = Date.now();
    const qrPath = `${agency.id}/${report.id}/qr-${qrVersion}.png`;

    const { error: uploadError } = await admin.storage
      .from("report-assets")
      .upload(qrPath, qrBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const {
      data: { publicUrl: uploadedQrUrl },
    } = admin.storage.from("report-assets").getPublicUrl(qrPath);
    qrPublicUrl = uploadedQrUrl;

    const existingAssets =
      (report.final_report_json as { assets?: Record<string, string> })?.assets ??
      {};

    const finalReportJson = {
      ...(report.final_report_json as Record<string, unknown>),
      assets: {
        ...existingAssets,
        ...(qrPublicUrl ? { qr_code_url: qrPublicUrl } : {}),
      },
    };

    const { data, error } = await supabase
      .from("reports")
      .update({
        public_slug: publicSlug,
        public_url: publicUrl,
        qr_code_url: qrPublicUrl,
        final_report_json: finalReportJson,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", report.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await supabase
      .from("collateral_items")
      .update({ status: "published" })
      .eq("report_id", report.id)
      .eq("listing_id", listing.id);

    return NextResponse.json({
      public_url: publicUrl,
      qr_code_url: qrPublicUrl,
      report: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publish failed" },
      { status: 400 },
    );
  }
}
