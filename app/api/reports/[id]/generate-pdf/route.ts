import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReportAccess } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportsUrl, getSiteUrl } from "@/lib/env";
import { renderPdfFromUrl, buildPdfImagePath } from "@/lib/browserless/pdf";
import { cacheBustedPdfUrl } from "@/lib/reports/cacheBustedPdfUrl";
import { buildPreviewPrintUrl } from "@/lib/reports/printAccessToken";

const generatePdfSchema = z.object({
  preview: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { supabase, agency, report } = await requireReportAccess(id);
    const body = generatePdfSchema.parse(await request.json().catch(() => ({})));
    const preview = body.preview === true;

    if (!report.final_report_json) {
      return NextResponse.json(
        { error: "Generate report copy before creating a PDF" },
        { status: 400 },
      );
    }

    if (!report.public_slug && !preview) {
      return NextResponse.json(
        { error: "Publish the report before generating a PDF" },
        { status: 400 },
      );
    }

    const printUrl = report.public_slug
      ? `${getReportsUrl().replace(/\/$/, "")}/${agency.slug}/${report.public_slug}/print`
      : buildPreviewPrintUrl(report.id, getSiteUrl());
    const admin = createAdminClient();

    const pdfBuffer = await renderPdfFromUrl(printUrl, {
      mirrorImage: async (sourceUrl, buffer, contentType) => {
        const path = buildPdfImagePath(
          agency.id,
          report.id,
          sourceUrl,
          contentType,
        );

        const { error } = await admin.storage
          .from("report-assets")
          .upload(path, buffer, {
            contentType,
            upsert: true,
          });

        if (error) {
          return null;
        }

        return admin.storage.from("report-assets").getPublicUrl(path).data
          .publicUrl;
      },
    });
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

    const cacheVersion = Date.now();
    const pdfUrl = cacheBustedPdfUrl(publicUrl, cacheVersion);

    const finalReportJson = {
      ...(report.final_report_json as Record<string, unknown>),
      assets: {
        ...((report.final_report_json as { assets?: Record<string, string> })
          ?.assets ?? {}),
        pdf_url: pdfUrl,
      },
    };

    const { data, error } = await supabase
      .from("reports")
      .update({
        pdf_url: pdfUrl,
        final_report_json: finalReportJson,
      })
      .eq("id", report.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ pdf_url: pdfUrl, report: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF generation failed" },
      { status: 400 },
    );
  }
}
