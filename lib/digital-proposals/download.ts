import { assetBucket } from "@/lib/storage/bucket";
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProposalError } from "./server";
import { safeDocumentName } from "./workspace";

/** Stream through our access check: revoking a link also blocks new downloads. */
export async function downloadProposalAttachment(agencyId: string, reportId: string, attachmentId: string) {
  const admin = createAdminClient();
  const record = await admin.from("digital_proposal_attachments").select("name,storage_path")
    .eq("id", attachmentId).eq("agency_id", agencyId).eq("report_id", reportId).maybeSingle();
  if (record.error || !record.data) throw new ProposalError("Document not found.", 404);
  const file = await assetBucket(admin, "proposal-documents").download(record.data.storage_path);
  if (file.error || !file.data) throw new ProposalError("Document unavailable.", 404);
  return new Response(await file.data.arrayBuffer(), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(safeDocumentName(record.data.name)).replace(/'/g, "%27")}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "sandbox",
  } });
}
