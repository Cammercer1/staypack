import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichListingForLeaseAppraisal } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
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
}: {
  supabase: SupabaseClient;
  jobId: string;
  message: string;
}) {
  await supabase
    .from("lease_appraisal_jobs")
    .update({
      status: "failed",
      error_message: message,
      failed_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function runLeaseAppraisalJob({
  supabase,
  jobId,
}: RunLeaseAppraisalJobInput) {
  try {
    const job = await loadJob(supabase, jobId);

    if (job.status === "completed") {
      return job;
    }

    const now = new Date().toISOString();
    const { data: processingJob, error: processingError } = await supabase
      .from("lease_appraisal_jobs")
      .update({
        status: "processing",
        attempts: (job.attempts ?? 0) + 1,
        started_at: job.started_at ?? now,
        heartbeat_at: now,
        error_message: null,
      })
      .eq("id", job.id)
      .select("*")
      .single();

    if (processingError || !processingJob) {
      throw new Error(processingError?.message ?? "Unable to start lease job");
    }

    const listing = await loadListing(
      supabase,
      processingJob as LeaseAppraisalJob,
    );
    const result = await enrichListingForLeaseAppraisal({
      supabase,
      listing,
      requestId: job.id,
    });

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
      .eq("id", job.id)
      .select("*")
      .single();

    if (completedError || !completedJob) {
      throw new Error(completedError?.message ?? "Unable to complete lease job");
    }

    return completedJob as LeaseAppraisalJob;
  } catch (error) {
    await markJobFailed({
      supabase,
      jobId,
      message: messageFromError(error),
    }).catch((saveError) => {
      console.error("Failed to mark lease appraisal job failed:", saveError);
    });

    throw error;
  }
}
