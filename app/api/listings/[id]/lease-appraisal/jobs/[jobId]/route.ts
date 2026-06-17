import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isLeaseAppraisalJobActive,
  leaseAppraisalJobTimeoutMessage,
} from "@/lib/lease-appraisal/leaseAppraisalJobs";
import type { LeaseAppraisalJob, Listing } from "@/lib/types";

function failedJob(job: LeaseAppraisalJob, errorMessage: string): LeaseAppraisalJob {
  const now = new Date().toISOString();
  return {
    ...job,
    status: "failed",
    error_message: errorMessage,
    failed_at: now,
    heartbeat_at: now,
    updated_at: now,
  };
}

async function markStaleJobFailed(job: LeaseAppraisalJob) {
  const next = failedJob(job, leaseAppraisalJobTimeoutMessage(job));
  const { data } = await createAdminClient()
    .from("lease_appraisal_jobs")
    .update({
      status: next.status,
      error_message: next.error_message,
      failed_at: next.failed_at,
      heartbeat_at: next.heartbeat_at,
    })
    .eq("id", job.id)
    .select("*")
    .single();

  return (data as LeaseAppraisalJob | null) ?? next;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  try {
    const { id, jobId } = await params;
    const { supabase, listing } = await requireListingAccess(id);

    const { data: job, error: jobError } = await supabase
      .from("lease_appraisal_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("listing_id", listing.id)
      .eq("agency_id", listing.agency_id)
      .maybeSingle();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 400 });
    }

    if (!job) {
      return NextResponse.json({ error: "Lease job not found" }, { status: 404 });
    }

    let resolvedJob = job as LeaseAppraisalJob;
    if (
      ["pending", "processing"].includes(resolvedJob.status) &&
      !isLeaseAppraisalJobActive(resolvedJob)
    ) {
      resolvedJob = await markStaleJobFailed(resolvedJob);
    }

    let resolvedListing = listing as Listing;
    if (resolvedJob.status === "completed" || resolvedJob.status === "failed") {
      const { data: refreshedListing } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listing.id)
        .eq("agency_id", listing.agency_id)
        .maybeSingle();

      if (refreshedListing) {
        resolvedListing = refreshedListing as Listing;
      }
    }

    return NextResponse.json({
      job: resolvedJob,
      listing: resolvedListing,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load lease job",
      },
      { status: 500 },
    );
  }
}
