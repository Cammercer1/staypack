import { applyDocumentLinkDraft } from "@/lib/documents/documentLink";
import { NextResponse } from "next/server";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { getReportsUrl } from "@/lib/env";
import {
  buildPublicReportUrl,
  generateReportSlug,
} from "@/lib/reports/slugs";

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

    const publicSlug = report.public_slug ?? generateReportSlug();
    const publicUrl = buildPublicReportUrl(
      getReportsUrl(),
      agency.slug,
      publicSlug,
    );

    const finalReportJson = applyDocumentLinkDraft(report.final_report_json);
    const qrPublicUrl = finalReportJson.assets.qr_code_url || null;

    const { data, error } = await supabase
      .from("reports")
      .update({
        public_slug: publicSlug,
        public_url: publicUrl,
        qr_code_url: qrPublicUrl,
        final_report_json: finalReportJson,
        ...(report.final_report_json.document_link_draft ? { pdf_url: null } : {}),
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
