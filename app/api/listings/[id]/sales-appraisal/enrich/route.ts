import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrichListingForSalesAppraisal } from "@/lib/sales-appraisal/enrichListingForSalesAppraisal";
import {
  salesAppraisalJobsTableMissing,
  isSalesAppraisalJobActive,
} from "@/lib/sales-appraisal/salesAppraisalJobs";
import {
  SALES_APPRAISAL_JOB_SIGNATURE_HEADER,
  SALES_APPRAISAL_JOB_TS_HEADER,
  signSalesAppraisalJobBody,
} from "@/lib/sales-appraisal/salesAppraisalJobAuth";
import { stripInternalSalesAppraisalWarnings } from "@/lib/sales/userFacingSalesWarnings";
import { isDevelopment } from "@/lib/env";
import type { SalesAppraisalJob } from "@/lib/types";

export const maxDuration = 60;

const BACKGROUND_JOB_PATH = "/background/sales-appraisal-enrich";

function shouldRunSynchronously() {
  return isDevelopment() || process.env.SALES_APPRAISAL_ENRICH_SYNC === "1";
}

function backgroundJobUrl(request: Request) {
  const override = process.env.SALES_APPRAISAL_JOB_BACKGROUND_URL?.trim();
  if (override) {
    return override;
  }

  return new URL(BACKGROUND_JOB_PATH, request.url).toString();
}

async function runSynchronously({
  supabase,
  listing,
}: Pick<Awaited<ReturnType<typeof requireListingAccess>>, "supabase" | "listing">) {
  const result = await enrichListingForSalesAppraisal({ supabase, listing });

  return NextResponse.json({
    listing: result.listing,
    warnings: stripInternalSalesAppraisalWarnings(result.warnings),
    compCount: result.parsed.salesAppraisal?.compCount ?? 0,
    priceMin: result.parsed.salesAppraisal?.priceMin ?? null,
    priceMax: result.parsed.salesAppraisal?.priceMax ?? null,
  });
}

async function markJobFailed(job: SalesAppraisalJob, message: string) {
  const admin = createAdminClient();
  await admin
    .from("sales_appraisal_jobs")
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
      .from("sales_appraisal_jobs")
      .select("*")
      .eq("listing_id", listing.id)
      .eq("agency_id", agency.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(5);

    if (existingError) {
      if (salesAppraisalJobsTableMissing(existingError)) {
        return runSynchronously({ supabase, listing });
      }
      throw new Error(existingError.message);
    }

    const existingJob = (existingJobs as SalesAppraisalJob[] | null)?.find((job) =>
      isSalesAppraisalJobActive(job),
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
      .from("sales_appraisal_jobs")
      .insert({
        agency_id: agency.id,
        listing_id: listing.id,
        created_by: user.id,
        status: "pending",
        request_json: {
          listing_updated_at: listing.updated_at,
          purpose: "sales_appraisal_comps",
        },
      })
      .select("*")
      .single();

    if (jobError || !job) {
      if (salesAppraisalJobsTableMissing(jobError)) {
        return runSynchronously({ supabase, listing });
      }
      throw new Error(jobError?.message ?? "Unable to create sales job");
    }

    const body = JSON.stringify({ jobId: job.id });
    const { timestamp, signature } = signSalesAppraisalJobBody(body);
    let invokeResponse: Response;
    try {
      invokeResponse = await fetch(backgroundJobUrl(request), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [SALES_APPRAISAL_JOB_TS_HEADER]: timestamp,
          [SALES_APPRAISAL_JOB_SIGNATURE_HEADER]: signature,
        },
        body,
        cache: "no-store",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start sales job";
      await markJobFailed(job as SalesAppraisalJob, message);
      return NextResponse.json(
        { error: "Unable to start sale comps", job },
        { status: 502 },
      );
    }

    if (!invokeResponse.ok) {
      await markJobFailed(
        job as SalesAppraisalJob,
        `Unable to start background sale comps (${invokeResponse.status})`,
      );

      return NextResponse.json(
        { error: "Unable to start sale comps", job },
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
            : "Unable to fetch sale comps",
      },
      { status: 500 },
    );
  }
}
