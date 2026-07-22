import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichListingForSalesAppraisal } from "@/lib/sales-appraisal/generateSalesAppraisalForListing";
import type { SalesAppraisalJob, Listing } from "@/lib/types";

type RunSalesAppraisalJobInput = {
  supabase: SupabaseClient;
  jobId: string;
};

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to fetch sale comps";
}

async function loadJob(supabase: SupabaseClient, jobId: string) {
  const { data, error } = await supabase
    .from("sales_appraisal_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Sales appraisal job not found");
  }

  return data as SalesAppraisalJob;
}

async function loadListing(supabase: SupabaseClient, job: SalesAppraisalJob) {
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
    .from("sales_appraisal_jobs")
    .update({
      status: "failed",
      error_message: message,
      failed_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function runSalesAppraisalJob({
  supabase,
  jobId,
}: RunSalesAppraisalJobInput) {
  try {
    const job = await loadJob(supabase, jobId);

    if (job.status === "completed") {
      return job;
    }

    const now = new Date().toISOString();
    const { data: processingJob, error: processingError } = await supabase
      .from("sales_appraisal_jobs")
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
      throw new Error(processingError?.message ?? "Unable to start sales job");
    }

    const listing = await loadListing(
      supabase,
      processingJob as SalesAppraisalJob,
    );
    const result = await enrichListingForSalesAppraisal({
      supabase,
      listing,
      requestId: job.id,
    });

    const appraisal = result.parsed.salesAppraisal;
    const completedAt = new Date().toISOString();
    const { data: completedJob, error: completedError } = await supabase
      .from("sales_appraisal_jobs")
      .update({
        status: "completed",
        result_json: {
          listing_id: result.listing.id,
          comp_count: result.parsed.salesComps?.length ?? 0,
          appraisal_comp_count: appraisal?.compCount ?? null,
          featured_comp_count: appraisal?.featuredCompCount ?? null,
          sold_comp_count: appraisal?.soldCompCount ?? null,
          for_sale_comp_count: appraisal?.forSaleCompCount ?? null,
          price_min: appraisal?.priceMin ?? null,
          price_max: appraisal?.priceMax ?? null,
          price_midpoint: appraisal?.priceMidpoint ?? null,
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
      throw new Error(completedError?.message ?? "Unable to complete sales job");
    }

    return completedJob as SalesAppraisalJob;
  } catch (error) {
    await markJobFailed({
      supabase,
      jobId,
      message: messageFromError(error),
    }).catch((saveError) => {
      console.error("Failed to mark sales appraisal job failed:", saveError);
    });

    throw error;
  }
}
