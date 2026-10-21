import { assetBucket } from "@/lib/storage/bucket";
import { createAdminClient } from "@/lib/supabase/admin";
import { cachedProposalSnapshot, publishedProposalAccess, ProposalError } from "@/lib/digital-proposals/published";
import { proposalApiError } from "@/lib/digital-proposals/http";
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const version = await publishedProposalAccess((await params).token);
    if (version.pdf_status !== "ready" || !version.pdf_path) throw new ProposalError("The proposal PDF is still being prepared. Please try again shortly.", 409);
    const result = await assetBucket(createAdminClient(), "proposal-pdfs").download(version.pdf_path);
    if (result.error || !result.data) throw new ProposalError("PDF unavailable. Please try again.", 503);
    const snapshot = await cachedProposalSnapshot(version.id, version.content_hash);
    const kind = snapshot.data.appraisal?.kind;
    const filename = kind === "sales" ? "Sales appraisal.pdf" : kind === "lease" ? "Rental appraisal.pdf" : "Short-term rental proposal.pdf";
    return new Response(result.data.stream(), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "sandbox" } });
  } catch (error) { return proposalApiError(error); }
}
