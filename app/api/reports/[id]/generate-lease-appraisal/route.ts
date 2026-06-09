import { NextResponse } from "next/server";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import {
  generateLeaseAppraisalReportContent,
} from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { assertTemplateGranted } from "@/lib/templates/grants/assertTemplateGranted";
import { templateGrantErrorResponse } from "@/lib/templates/grants/apiErrors";
import { z } from "zod";

export const maxDuration = 300;

const bodySchema = z.object({
  template_id: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, report, listing } = await requireReportWithListing(id);
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    if (listing.listing_purpose === "lease") {
      return NextResponse.json(
        { error: "Lease appraisals are only available for listings for sale" },
        { status: 400 },
      );
    }

    const templateId = body.template_id ?? report.template_id ?? undefined;
    if (!templateId || !isLeaseAppraisalTemplateId(templateId)) {
      return NextResponse.json(
        { error: "Choose a lease appraisal template before generating content" },
        { status: 400 },
      );
    }

    try {
      await assertTemplateGranted(agency.id, templateId);
    } catch (grantError) {
      const denied = templateGrantErrorResponse(grantError);
      if (denied) {
        return denied;
      }
      throw grantError;
    }

    const agentProfile = await loadListingAgentProfile(supabase, listing);
    const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);

    const result = await generateLeaseAppraisalReportContent({
      supabase,
      agency,
      listing,
      report: { ...report, template_id: templateId },
      agencyAgents: agentProfile
        ? [agentProfile, ...agencyAgents.filter((a) => a.id !== agentProfile.id)]
        : agencyAgents,
      templateId,
    });

    return NextResponse.json({
      report: result.report,
      listing: result.listing,
      compCount: result.parsed.rentalAppraisal?.compCount ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Lease appraisal generation failed",
      },
      { status: 400 },
    );
  }
}
