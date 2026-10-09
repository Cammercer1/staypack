import { NextResponse } from "next/server";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { applyDocumentLinkDraft, documentLinkSchema } from "@/lib/documents/documentLink";
import { createDocumentLinkDraft } from "@/lib/documents/createDocumentLinkDraft";
import { isBrochureDocument, isBusinessCardDocument } from "@/lib/collateral/templates/types";
import { withBrochureContentSaved } from "@/lib/collateral/sales-brochure/brochurePublishSync";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, agency, collateral } = await requireCollateralAccess(id);
    const document = collateral.document_json;
    if (!document || (!isBrochureDocument(document) && !isBusinessCardDocument(document))) {
      return NextResponse.json({ error: "Generate a brochure or business card before choosing its link" }, { status: 400 });
    }
    const link = documentLinkSchema.parse(await request.json());
    // Brochures and cards have no standalone online report viewer.
    if (link.mode === "report") return NextResponse.json({ error: "Choose a custom URL for this document" }, { status: 400 });
    const draft = await createDocumentLinkDraft({ link, agencyId: agency.id, documentId: collateral.id });
    const pending = { ...document, document_link_draft: draft };
    const next = isBrochureDocument(pending)
      ? withBrochureContentSaved(pending)
      : applyDocumentLinkDraft(pending);
    const { data, error } = await supabase.from("collateral_items").update({
      document_json: next,
      ...(isBusinessCardDocument(next) ? { qr_code_url: next.assets.qr_code_url || null, pdf_url: null } : {}),
    }).eq("id", collateral.id).eq("agency_id", agency.id).eq("updated_at", collateral.updated_at).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "This document changed while saving. Reload and try again." }, { status: 409 });
    return NextResponse.json({ collateral: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save link" }, { status: 400 });
  }
}
