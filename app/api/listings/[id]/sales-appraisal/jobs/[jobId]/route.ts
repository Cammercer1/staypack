import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSalesAppraisalJobActive,
  salesAppraisalJobTimeoutMessage,
} from "@/lib/sales-appraisal/salesAppraisalJobs";
import type { SalesAppraisalJob, Listing } from "@/lib/types";

function failedJob(job: SalesAppraisalJob, errorMessage: string): SalesAppraisalJob {
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

async function markStaleJobFailed(job: SalesAppraisalJob) {
  const next = failedJob(job, salesAppraisalJobTimeoutMessage(job));
  const { data } = await createAdminClient()
    .from("sales_appraisal_jobs")
    .update({
      status: next.status,
      error_message: next.error_message,
      failed_at: next.failed_at,
      heartbeat_at: next.heartbeat_at,
    })
    .eq("id", job.id)
    .select("*")
    .single();

  return (data as SalesAppraisalJob | null) ?? next;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  try {
    const { id, jobId } = await params;
    const { supabase, listing } = await requireListingAccess(id);

    const { data: job, error: jobError } = await supabase
      .from("sales_appraisal_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("listing_id", listing.id)
      .eq("agency_id", listing.agency_id)
      .maybeSingle();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 400 });
    }

    if (!job) {
      return NextResponse.json({ error: "Sales job not found" }, { status: 404 });
    }

    let resolvedJob = job as SalesAppraisalJob;
    if (
      ["pending", "processing"].includes(resolvedJob.status) &&
      !isSalesAppraisalJobActive(resolvedJob)
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
            : "Unable to load sales job",
      },
      { status: 500 },
    );
  }
}
