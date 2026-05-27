import { NextResponse } from "next/server";
import { requireReportAccess } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportsUrl } from "@/lib/env";
import {
  buildPublicReportUrl,
  generateReportSlug,
} from "@/lib/reports/slugs";
import { generateQrCodeBuffer } from "@/lib/reports/qr";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, report } = await requireReportAccess(id);

    if (!report.final_report_json) {
      return NextResponse.json(
        { error: "Generate report copy before publishing" },
        { status: 400 },
      );
    }

    const publicSlug = report.public_slug ?? generateReportSlug();
    const publicUrl = buildPublicReportUrl(
      getReportsUrl(),
      agency.slug,
      publicSlug,
    );

    const admin = createAdminClient();
    const qrBuffer = await generateQrCodeBuffer(publicUrl);
    const qrPath = `${agency.id}/${report.id}/qr.png`;

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
      data: { publicUrl: qrPublicUrl },
    } = admin.storage.from("report-assets").getPublicUrl(qrPath);

    const finalReportJson = {
      ...(report.final_report_json as Record<string, unknown>),
      assets: {
        ...((report.final_report_json as { assets?: Record<string, string> })
          ?.assets ?? {}),
        qr_code_url: qrPublicUrl,
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
