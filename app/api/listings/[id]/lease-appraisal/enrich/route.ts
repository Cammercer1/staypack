import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrichListingForLeaseAppraisal } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import {
  leaseAppraisalJobsTableMissing,
  isLeaseAppraisalJobActive,
} from "@/lib/lease-appraisal/leaseAppraisalJobs";
import {
  LEASE_APPRAISAL_JOB_SIGNATURE_HEADER,
  LEASE_APPRAISAL_JOB_TS_HEADER,
  signLeaseAppraisalJobBody,
} from "@/lib/lease-appraisal/leaseAppraisalJobAuth";
import { stripInternalRentalAppraisalWarnings } from "@/lib/rental/userFacingRentalWarnings";
import { isDevelopment } from "@/lib/env";
import type { LeaseAppraisalJob } from "@/lib/types";

export const maxDuration = 60;

const BACKGROUND_JOB_PATH = "/background/lease-appraisal-enrich";

function shouldRunSynchronously() {
  return isDevelopment() || process.env.LEASE_APPRAISAL_ENRICH_SYNC === "1";
}

function backgroundJobUrl(request: Request) {
  const override = process.env.LEASE_APPRAISAL_JOB_BACKGROUND_URL?.trim();
  if (override) {
    return override;
  }

  return new URL(BACKGROUND_JOB_PATH, request.url).toString();
}

async function runSynchronously({
  supabase,
  listing,
}: Pick<Awaited<ReturnType<typeof requireListingAccess>>, "supabase" | "listing">) {
  const result = await enrichListingForLeaseAppraisal({ supabase, listing });

  return NextResponse.json({
    listing: result.listing,
    warnings: stripInternalRentalAppraisalWarnings(result.warnings),
    compCount: result.parsed.rentalAppraisal?.compCount ?? 0,
    weeklyMin: result.parsed.rentalAppraisal?.weeklyMin ?? null,
    weeklyMax: result.parsed.rentalAppraisal?.weeklyMax ?? null,
  });
}

async function markJobFailed(job: LeaseAppraisalJob, message: string) {
  const admin = createAdminClient();
  await admin
    .from("lease_appraisal_jobs")
    .update({
      status: "failed",
      error_message: message,
      failed_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, listing, agency, user } = await requireListingAccess(id);

    if (!listing.scraped_listing_json) {
      return NextResponse.json(
        { error: "Import the listing URL first" },
        { status: 400 },
      );
    }

    if (shouldRunSynchronously()) {
      return runSynchronously({ supabase, listing });
    }

    const { data: existingJobs, error: existingError } = await supabase
      .from("lease_appraisal_jobs")
      .select("*")
      .eq("listing_id", listing.id)
      .eq("agency_id", agency.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(5);

    if (existingError) {
      if (leaseAppraisalJobsTableMissing(existingError)) {
        return runSynchronously({ supabase, listing });
      }
      throw new Error(existingError.message);
    }

    const existingJob = (existingJobs as LeaseAppraisalJob[] | null)?.find((job) =>
      isLeaseAppraisalJobActive(job),
    );

    if (existingJob) {
      return NextResponse.json(
        {
          listing,
          job: existingJob,
          status: existingJob.status,
        },
        { status: 202 },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from("lease_appraisal_jobs")
      .insert({
        agency_id: agency.id,
        listing_id: listing.id,
        created_by: user.id,
        status: "pending",
        request_json: {
          listing_updated_at: listing.updated_at,
          purpose: "lease_appraisal_comps",
        },
      })
      .select("*")
      .single();

    if (jobError || !job) {
      if (leaseAppraisalJobsTableMissing(jobError)) {
        return runSynchronously({ supabase, listing });
      }
      throw new Error(jobError?.message ?? "Unable to create lease job");
    }

    const body = JSON.stringify({ jobId: job.id });
    const { timestamp, signature } = signLeaseAppraisalJobBody(body);
    let invokeResponse: Response;
    try {
      invokeResponse = await fetch(backgroundJobUrl(request), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [LEASE_APPRAISAL_JOB_TS_HEADER]: timestamp,
          [LEASE_APPRAISAL_JOB_SIGNATURE_HEADER]: signature,
        },
        body,
        cache: "no-store",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start lease job";
      await markJobFailed(job as LeaseAppraisalJob, message);
      return NextResponse.json(
        { error: "Unable to start rental comps", job },
        { status: 502 },
      );
    }

    if (!invokeResponse.ok) {
      await markJobFailed(
        job as LeaseAppraisalJob,
        `Unable to start background rental comps (${invokeResponse.status})`,
      );

      return NextResponse.json(
        { error: "Unable to start rental comps", job },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        listing,
        job,
        status: "pending",
      },
      { status: 202 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to fetch rental comps",
      },
      { status: 500 },
    );
  }
}
