import { NextResponse } from "next/server";
import { requireReportAccess } from "@/lib/auth/requireUser";
import { documentLinkSchema } from "@/lib/documents/documentLink";
import { createDocumentLinkDraft } from "@/lib/documents/createDocumentLinkDraft";
import { buildPublicReportUrl, generateReportSlug } from "@/lib/reports/slugs";
import { getReportsUrl } from "@/lib/env";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, agency, report } = await requireReportAccess(id);
    if (!report.final_report_json || report.status === "archived") {
      return NextResponse.json({ error: "Generate a report before choosing its link" }, { status: 400 });
    }
    const link = documentLinkSchema.parse(await request.json());
    const publicSlug = report.public_slug ?? generateReportSlug();
    const reportUrl = buildPublicReportUrl(getReportsUrl(), agency.slug, publicSlug);
    const draft = await createDocumentLinkDraft({ link, agencyId: agency.id, documentId: report.id, reportUrl });
    const { data, error } = await supabase.from("reports").update({
      public_slug: publicSlug,
      final_report_json: { ...report.final_report_json, document_link_draft: draft },
    }).eq("id", report.id).eq("agency_id", agency.id).eq("updated_at", report.updated_at).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "This report changed while saving. Reload and try again." }, { status: 409 });
    return NextResponse.json({ report: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save link" }, { status: 400 });
  }
}
