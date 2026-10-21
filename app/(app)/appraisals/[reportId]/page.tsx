import { isLeaseAppraisalJobActive } from "@/lib/lease-appraisal/leaseAppraisalJobs";
import type { LeaseAppraisalJob } from "@/lib/types";
import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { requireAppraisalAccess } from "@/lib/appraisals/workspace";
import { appraisalKindLabels, appraisalPath } from "@/lib/appraisals/workspaceTypes";
import { AppraisalWorkspace } from "@/components/appraisals/AppraisalWorkspace";
import { ProposalError } from "@/lib/digital-proposals/errors";
import { hasPublishedProposal } from "@/lib/digital-proposals/publication";
export default async function AppraisalPage({ params }: { params: Promise<{ reportId: string }> }) {
  let context;
  try { context = await requireAppraisalAccess((await params).reportId); }
  catch(error) { unstable_rethrow(error); if (error instanceof ProposalError && error.status === 404) notFound(); throw error; }
  const { appraisal, workingListing, report, listing } = context;
  if (appraisal.kind === "str") redirect(appraisalPath(report.id,"str"));
  const archived = report.status === "archived" || listing.status === "archived";
  const [jobs, publishedProposal] = await Promise.all([
    context.supabase.from(`${appraisal.kind}_appraisal_jobs`).select("*").eq("agency_id", appraisal.agency_id).eq("listing_id", listing.id).contains("request_json", { appraisal_report_id: report.id }).in("status", ["pending", "processing"]).order("created_at", { ascending: false }).limit(5),
    archived ? false : hasPublishedProposal(context.supabase, appraisal.agency_id, report.id),
  ]);
  const activeJob = (jobs.data as LeaseAppraisalJob[] | null)?.find(isLeaseAppraisalJobActive) ?? null;
  return <div className="space-y-6"><Link href="/appraisals" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Back to appraisals</Link><header><h1 className="font-display text-3xl">{appraisalKindLabels[appraisal.kind]} appraisal</h1><p className="mt-2 text-muted-foreground">{workingListing.property_address}</p></header><AppraisalWorkspace initialJob={activeJob} initialAppraisal={appraisal} initialListing={workingListing} hasPublishedProposal={publishedProposal} archived={archived} /></div>;
}
