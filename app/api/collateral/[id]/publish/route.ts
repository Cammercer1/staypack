import { NextResponse } from "next/server";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { provisionCollateralQr } from "@/lib/collateral/provisionCollateralQr";
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
import type { Listing } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, collateral, listing } =
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

    const { qrCodeUrl } = await provisionCollateralQr({
      agency,
      listing: listing as Listing,
      collateral,
      supabase,
    });

    const publicSlug = collateral.public_slug ?? generateCollateralSlug();
    const publicUrl = buildPublicCollateralUrl(agency.slug, publicSlug);

    const existingDocument = collateral.document_json as BrochureDocumentJson;
    const documentJson: BrochureDocumentJson = isBrochureDocument(
      existingDocument,
    )
      ? withBrochureContentSaved({
          ...existingDocument,
          assets: {
            ...existingDocument.assets,
            qr_code_url: qrCodeUrl,
          },
        })
      : existingDocument;

    const { data, error } = await supabase
      .from("collateral_items")
      .update({
        public_slug: publicSlug,
        public_url: publicUrl,
        document_json: documentJson,
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
