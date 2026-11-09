import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import { ProposalError } from "@/lib/digital-proposals/errors";
import type { Listing, Report } from "@/lib/types";
import { appraisalListing } from "./workspaceInputs";
import { checkAppraisalError } from "./workspacePersistence";
import type { WorkspaceAppraisal } from "./workspaceTypes";

/** One RLS-protected read, shared only within the current server render. */
export const requireAppraisalAccess = cache(async (reportId: string) => {
  if (!z.uuid().safeParse(reportId).success) throw new ProposalError("Appraisal not found.", 404);
  const context = await requireAgency();
  const result = await context.supabase.from("appraisals")
    .select("*,report:reports!inner(*,listing:listings!inner(*))")
    .eq("report_id", reportId).eq("agency_id", context.agency.id)
    .eq("report.agency_id", context.agency.id).eq("report.listing.agency_id", context.agency.id).maybeSingle();
  checkAppraisalError(result.error);
  if (!result.data) throw new ProposalError("Appraisal not found.", 404);
  const { report: joined, ...appraisal } = result.data as unknown as WorkspaceAppraisal & { report: Report & { listing: Listing } };
  const { listing, ...report } = joined;
  if (report.id !== reportId || report.agency_id !== context.agency.id || listing.agency_id !== context.agency.id || report.listing_id !== listing.id) {
    throw new ProposalError("Appraisal not found.", 404);
  }
  return { ...context, appraisal, report, listing, workingListing: appraisalListing(listing, appraisal) };
});
