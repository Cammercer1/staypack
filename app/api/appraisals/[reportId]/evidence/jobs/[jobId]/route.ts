import { requireAppraisalAccess, requireEditableAppraisal, checkAppraisalError } from "@/lib/appraisals/workspace";
import { isLeaseAppraisalJobActive } from "@/lib/lease-appraisal/leaseAppraisalJobs";
import { privateJson } from "@/lib/str-appraisals/api";
import { proposalApiError } from "@/lib/digital-proposals/http";
import { ProposalError } from "@/lib/digital-proposals/errors";
import type { LeaseAppraisalJob } from "@/lib/types";
export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string; jobId: string }> }) {
  try {
    const { reportId, jobId } = await params; const context = await requireAppraisalAccess(reportId); const kind = requireEditableAppraisal(context);
    const result = await context.supabase.from(`${kind}_appraisal_jobs`).select("*").eq("id", jobId).eq("agency_id", context.agency.id).eq("listing_id", context.listing.id).contains("request_json", { appraisal_report_id: reportId }).maybeSingle();
    checkAppraisalError(result.error);
    if (!result.data) throw new ProposalError("Appraisal job not found.", 404);
    let job = result.data as LeaseAppraisalJob;
    if (["pending", "processing"].includes(job.status) && !isLeaseAppraisalJobActive(job)) job = { ...job, status: "failed", error_message: "Comparable search timed out. Refresh comparables to try again." };
    return privateJson({ job, listing: context.workingListing, appraisal: context.appraisal });
  } catch (error) { return proposalApiError(error); }
}
