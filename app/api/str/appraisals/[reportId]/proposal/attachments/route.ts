import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson } from "@/lib/str-appraisals/api";
import { proposalContext, ProposalError } from "@/lib/digital-proposals/server";
import { proposalApiError, sameOrigin } from "@/lib/digital-proposals/http";
import { isPdf, MAX_PROPOSAL_PDF_BYTES, safeDocumentName } from "@/lib/digital-proposals/workspace";
export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    sameOrigin(request);
    const context = await proposalContext((await params).reportId, request);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_PROPOSAL_PDF_BYTES + 20000) throw new ProposalError("Choose a PDF under 4 MB.", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf" || !file.size || file.size > MAX_PROPOSAL_PDF_BYTES) throw new ProposalError("Choose a PDF under 4 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(bytes)) throw new ProposalError("This file is not a PDF.");
    const admin = createAdminClient();
    const count = await admin.from("digital_proposal_attachments").select("id", { count: "exact", head: true }).eq("report_id", context.report.id).eq("agency_id", context.agency.id);
    if (count.error) throw new ProposalError("Unable to check existing attachments.", 500);
    if ((count.count ?? 0) >= 50) throw new ProposalError("This proposal has reached its document limit.");
    const id = randomUUID();
    const path = `${context.agency.id}/${context.report.id}/${id}.pdf`;
    const uploaded = await admin.storage.from("proposal-documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploaded.error) throw new ProposalError("Document upload failed. Please try again.", 500);
    const attachment = { id, name: safeDocumentName(file.name), byte_size: file.size };
    const saved = await admin.from("digital_proposal_attachments").insert({ ...attachment, storage_path: path, report_id: context.report.id, agency_id: context.agency.id });
    if (saved.error) {
      await admin.storage.from("proposal-documents").remove([path]);
      throw new ProposalError("Unable to save the document.", 500);
    }
    return privateJson({ attachment }, 201);
  } catch (error) { return proposalApiError(error); }
}
