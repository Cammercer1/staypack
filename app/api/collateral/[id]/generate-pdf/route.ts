import { NextResponse } from "next/server";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCollateralPreviewPrintUrl } from "@/lib/collateral/printAccessToken";
import {
  isBrochureDocument,
  type BrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { withBrochurePdfSynced } from "@/lib/collateral/sales-brochure/brochurePublishSync";
import { getCollateralTemplate } from "@/lib/collateral/templates/registry";
import { renderPdfFromUrl, buildPdfImagePath, buildPdfStylesheetPath } from "@/lib/browserless/pdf";
import { cacheBustedPdfUrl } from "@/lib/reports/cacheBustedPdfUrl";
import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, collateral } = await requireCollateralAccess(id);

    if (!collateral.document_json) {
      return NextResponse.json(
        { error: "Generate collateral before creating a PDF" },
        { status: 400 },
      );
    }

    const document = collateral.document_json as CollateralDocumentJson;
    const template = getCollateralTemplate(document.template_id);
    const requestOrigin = new URL(request.url).origin;
    const printUrl =
      collateral.public_slug && collateral.status === "published"
        ? `${requestOrigin}/${agency.slug}/c/${collateral.public_slug}/print`
        : buildCollateralPreviewPrintUrl(collateral.id, requestOrigin);

    const admin = createAdminClient();
    const pdfBuffer = await renderPdfFromUrl(printUrl, {
      pageFormatId: template.pageFormat,
      mirrorImage: async (sourceUrl, buffer, contentType) => {
        const path = buildPdfImagePath(
          agency.id,
          collateral.id,
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
      mirrorStylesheet: async (sourceUrl, buffer, contentType) => {
        const path = buildPdfStylesheetPath(
          agency.id,
          collateral.id,
          sourceUrl,
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

    const pdfPath = `${agency.id}/collateral/${collateral.id}.pdf`;

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
      data: { publicUrl: storedPdfUrl },
    } = admin.storage.from("report-pdfs").getPublicUrl(pdfPath);

    const pdfUrl = cacheBustedPdfUrl(storedPdfUrl, Date.now());
    const generatedAt = new Date().toISOString();

    const existingDocument = collateral.document_json;
    const documentJson =
      existingDocument && isBrochureDocument(existingDocument)
        ? withBrochurePdfSynced(existingDocument as BrochureDocumentJson)
        : existingDocument;

    const { data, error } = await supabase
      .from("collateral_items")
      .update({
        pdf_url: pdfUrl,
        status: collateral.status === "draft" ? "generated" : collateral.status,
        generated_at: generatedAt,
        ...(documentJson ? { document_json: documentJson } : {}),
      })
      .eq("id", collateral.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ pdf_url: pdfUrl, collateral: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "PDF generation failed",
      },
      { status: 400 },
    );
  }
}
