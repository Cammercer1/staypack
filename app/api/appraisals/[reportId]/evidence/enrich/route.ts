import { z } from "zod";
import { requireAppraisalAccess, requireEditableAppraisal, checkAppraisalError } from "@/lib/appraisals/workspace";
import { appraisalInputError } from "@/lib/appraisals/resolveAppraisalInput";
import { enrichWorkspaceAppraisal } from "@/lib/appraisals/enrichWorkspaceAppraisal";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevelopment } from "@/lib/env";
import { isLeaseAppraisalJobActive } from "@/lib/lease-appraisal/leaseAppraisalJobs";
import { signLeaseAppraisalJobBody, LEASE_APPRAISAL_JOB_SIGNATURE_HEADER, LEASE_APPRAISAL_JOB_TS_HEADER } from "@/lib/lease-appraisal/leaseAppraisalJobAuth";
import { signSalesAppraisalJobBody, SALES_APPRAISAL_JOB_SIGNATURE_HEADER, SALES_APPRAISAL_JOB_TS_HEADER } from "@/lib/sales-appraisal/salesAppraisalJobAuth";
import { privateJson } from "@/lib/str-appraisals/api";
import { proposalApiError, proposalRequest } from "@/lib/digital-proposals/http";
import { ProposalError } from "@/lib/digital-proposals/errors";
import type { LeaseAppraisalJob } from "@/lib/types";
export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const context = await requireAppraisalAccess((await params).reportId);
    const kind = requireEditableAppraisal(context);
    const body = z.object({ expected_updated_at: z.iso.datetime({ offset: true }) }).strict().parse(await proposalRequest(request));
    if (body.expected_updated_at !== context.appraisal.updated_at) throw new ProposalError("This appraisal changed. Reload before fetching comparables.", 409);
    const inputError = appraisalInputError(context.workingListing);
    if (inputError) throw new ProposalError(inputError);
    if (isDevelopment() || process.env.APPRAISAL_ENRICH_SYNC === "1") {
      const result = await enrichWorkspaceAppraisal({ supabase: context.supabase, reportId: context.report.id, agencyId: context.agency.id, kind, expected: body.expected_updated_at });
      return privateJson(result);
    }
    const table = `${kind}_appraisal_jobs`;
    const existing = await context.supabase.from(table).select("*").eq("agency_id", context.agency.id).eq("listing_id", context.listing.id)
      .contains("request_json", { appraisal_report_id: context.report.id }).in("status", ["pending", "processing"]).order("created_at", { ascending: false }).limit(5);
    checkAppraisalError(existing.error);
    const active = (existing.data as LeaseAppraisalJob[]).find(job => isLeaseAppraisalJobActive(job));
    if (active) return privateJson({ job: active, listing: context.workingListing }, 202);
    const inserted = await context.supabase.from(table).insert({ agency_id: context.agency.id, listing_id: context.listing.id, created_by: context.user.id, status: "pending",
      request_json: { appraisal_report_id: context.report.id, appraisal_updated_at: context.appraisal.updated_at } }).select("*").single();
    checkAppraisalError(inserted.error);
    const job = inserted.data as LeaseAppraisalJob;
    try {
      const payload = JSON.stringify({ jobId: job.id });
      const { timestamp, signature } = (kind === "lease" ? signLeaseAppraisalJobBody : signSalesAppraisalJobBody)(payload);
      const endpoint = (kind === "lease" ? process.env.LEASE_APPRAISAL_JOB_BACKGROUND_URL : process.env.SALES_APPRAISAL_JOB_BACKGROUND_URL)?.trim() || new URL(`/background/${kind}-appraisal-enrich`, request.url).toString();
      const response = await fetch(endpoint, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json",
        [kind === "lease" ? LEASE_APPRAISAL_JOB_TS_HEADER : SALES_APPRAISAL_JOB_TS_HEADER]: timestamp,
        [kind === "lease" ? LEASE_APPRAISAL_JOB_SIGNATURE_HEADER : SALES_APPRAISAL_JOB_SIGNATURE_HEADER]: signature }, body: payload });
      if (!response.ok) throw new Error("Job invocation failed");
    } catch {
      await createAdminClient().from(table).update({ status: "failed", error_message: "Unable to start comparable search. Please try again.", failed_at: new Date().toISOString() }).eq("id", job.id);
      throw new ProposalError("Unable to start comparable search. Please try again.", 502);
    }
    return privateJson({ job, listing: context.workingListing }, 202);
  } catch (error) { return proposalApiError(error); }
}
