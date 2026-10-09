import { NextResponse } from "next/server";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { applyDocumentLinkDraft } from "@/lib/documents/documentLink";
import {
  buildPublicCollateralUrl,
  generateCollateralSlug,
} from "@/lib/collateral/slugs";
import { withBrochureContentSaved } from "@/lib/collateral/sales-brochure/brochurePublishSync";
import {
  isBrochureDocument,
  type BrochureDocumentJson,
} from "@/lib/collateral/templates/types";
import { getSiteUrl } from "@/lib/env";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, collateral } =
      await requireCollateralAccess(id);

    if (collateral.type !== "sales_brochure" && collateral.type !== "rental_brochure") {
      return NextResponse.json(
        { error: "Only brochures can be published with this endpoint" },
        { status: 400 },
      );
    }

    if (!collateral.document_json) {
      return NextResponse.json(
        { error: "Generate collateral before publishing" },
        { status: 400 },
      );
    }

    const publicSlug = collateral.public_slug ?? generateCollateralSlug();
    const publicUrl = buildPublicCollateralUrl(agency.slug, publicSlug);

    const existingDocument = collateral.document_json as BrochureDocumentJson;
    // Sharing an unchanged document does not make its prepared PDF stale.
    // Applying a pending QR choice does change the rendered document.
    const documentJson: BrochureDocumentJson = isBrochureDocument(
      existingDocument,
    ) && existingDocument.document_link_draft
      ? withBrochureContentSaved({
          ...applyDocumentLinkDraft(existingDocument),
        })
      : existingDocument;

    const { data, error } = await supabase
      .from("collateral_items")
      .update({
        public_slug: publicSlug,
        public_url: publicUrl,
        document_json: documentJson,
        ...(existingDocument.document_link_draft ? { pdf_url: null } : {}),
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", collateral.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      public_url: publicUrl,
      print_url: `${getSiteUrl().replace(/\/$/, "")}/${agency.slug}/c/${publicSlug}/print`,
      collateral: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publish failed" },
      { status: 400 },
    );
  }
}
