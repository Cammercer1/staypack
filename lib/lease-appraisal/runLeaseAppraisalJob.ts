import { claimAppraisalJob } from "@/lib/appraisals/claimJob";
import { requireListingAgencyCountry } from "@/lib/property-market/requireAgencyCountry";
import { enrichWorkspaceAppraisal } from "@/lib/appraisals/enrichWorkspaceAppraisal";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichListingForLeaseAppraisal } from "@/lib/lease-appraisal/enrichListingForLeaseAppraisal";
import type { LeaseAppraisalJob, Listing } from "@/lib/types";

type RunLeaseAppraisalJobInput = {
  supabase: SupabaseClient;
  jobId: string;
};

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to fetch rental comps";
}

async function loadJob(supabase: SupabaseClient, jobId: string) {
  const { data, error } = await supabase
    .from("lease_appraisal_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Lease appraisal job not found");
  }

  return data as LeaseAppraisalJob;
}

async function loadListing(supabase: SupabaseClient, job: LeaseAppraisalJob) {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", job.listing_id)
    .eq("agency_id", job.agency_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Listing not found");
  }

  return data as Listing;
}

async function markJobFailed({
  supabase,
  jobId,
  message,
  attempt,
}: {
  supabase: SupabaseClient;
  jobId: string;
  message: string;
  attempt: number;
}) {
  await supabase
    .from("lease_appraisal_jobs")
    .update({
      status: "failed",
      error_message: message,
      failed_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", jobId).eq("status", "processing").eq("attempts", attempt);
}

export async function runLeaseAppraisalJob({
  supabase,
  jobId,
}: RunLeaseAppraisalJobInput) {
  let ownedAttempt: number | undefined;
  try {
    const job = await loadJob(supabase, jobId);

    if (job.status === "completed") {
      return job;
    }

    const processingJob = await claimAppraisalJob(supabase, "lease_appraisal_jobs", job);
    ownedAttempt = processingJob.attempts;

    const listing = await loadListing(
      supabase,
      processingJob as LeaseAppraisalJob,
    );
    if (typeof job.request_json.appraisal_report_id !== "string") await requireListingAgencyCountry(supabase, listing);
    const result = typeof job.request_json.appraisal_report_id === "string"
      ? await enrichWorkspaceAppraisal({ supabase, reportId: job.request_json.appraisal_report_id, agencyId: job.agency_id, kind: "lease", expected: String(job.request_json.appraisal_updated_at) })
      : await enrichListingForLeaseAppraisal({ supabase, listing, requestId: job.id });

    const appraisal = result.parsed.rentalAppraisal;
    const completedAt = new Date().toISOString();
    const { data: completedJob, error: completedError } = await supabase
      .from("lease_appraisal_jobs")
      .update({
        status: "completed",
        result_json: {
          listing_id: result.listing.id,
          comp_count: result.parsed.rentalComps?.length ?? 0,
          appraisal_comp_count: appraisal?.compCount ?? null,
          featured_comp_count: appraisal?.featuredCompCount ?? null,
          weekly_min: appraisal?.weeklyMin ?? null,
          weekly_max: appraisal?.weeklyMax ?? null,
          weekly_midpoint: appraisal?.weeklyMidpoint ?? null,
          discovery: appraisal?.discovery ?? null,
          warnings: result.warnings,
        },
        completed_at: completedAt,
        heartbeat_at: completedAt,
        error_message: null,
      })
      .eq("id", job.id).eq("status", "processing").eq("attempts", ownedAttempt)
      .select("*")
      .single();

    if (completedError || !completedJob) {
      throw new Error(completedError?.message ?? "Unable to complete lease job");
    }

    return completedJob as LeaseAppraisalJob;
  } catch (error) {
    if (ownedAttempt !== undefined) await markJobFailed({
      supabase,
      jobId,
      message: messageFromError(error),
      attempt: ownedAttempt,
    }).catch((saveError) => {
      console.error("Failed to mark lease appraisal job failed:", saveError);
    });

    throw error;
  }
}
