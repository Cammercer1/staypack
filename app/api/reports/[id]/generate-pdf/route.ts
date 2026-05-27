import { NextResponse } from "next/server";
import { requireReportAccess } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportsUrl } from "@/lib/env";
import { renderPdfFromUrl } from "@/lib/browserless/pdf";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, report } = await requireReportAccess(id);

    if (!report.public_slug) {
      return NextResponse.json(
        { error: "Publish the report before generating a PDF" },
        { status: 400 },
      );
    }

    const printUrl = `${getReportsUrl().replace(/\/$/, "")}/${agency.slug}/${report.public_slug}/print`;
    const pdfBuffer = await renderPdfFromUrl(printUrl);
    const admin = createAdminClient();
    const pdfPath = `${agency.id}/${report.id}/report.pdf`;

    const { error: uploadError } = await admin.storage
      .from("report-pdfs")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("report-pdfs").getPublicUrl(pdfPath);

    const finalReportJson = {
      ...(report.final_report_json as Record<string, unknown>),
      assets: {
        ...((report.final_report_json as { assets?: Record<string, string> })
          ?.assets ?? {}),
        pdf_url: publicUrl,
      },
    };

    const { data, error } = await supabase
      .from("reports")
      .update({
        pdf_url: publicUrl,
        final_report_json: finalReportJson,
      })
      .eq("id", report.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ pdf_url: publicUrl, report: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF generation failed" },
      { status: 400 },
    );
  }
}
