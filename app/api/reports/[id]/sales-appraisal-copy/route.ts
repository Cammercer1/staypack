import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { rebuildSalesAppraisalFinalReport } from "@/lib/sales-appraisal/rebuildSalesAppraisalReport";
import { hasSalesAppraisalComps } from "@/lib/sales-appraisal/generateSalesAppraisalForListing";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";
import type { ReportPropertyImageSelection } from "@/lib/reports/editable/reportImageSlots";

const blurbVariantsSchema = z.object({
  short: z.string(),
  medium: z.string(),
  long: z.string(),
});

const copySchema = z.object({
  heading: z.string(),
  blurb: z.string(),
  blurb_variants: blurbVariantsSchema.optional(),
  key_metrics_line: z.string().optional().default(""),
  appeal_points: z.array(z.string()),
  supporting_factors: z.array(z.string()).optional().default([]),
  buyer_checks: z.array(z.string()).optional().default([]),
  methodology_note: z.string(),
  disclaimer: z.string(),
  comparable_evidence: z.string(),
  comparable_disclaimer: z.string(),
  cta: z.string(),
});

const propertyImagesSchema = z.object({
  hero_image_url: z.string().optional(),
  selected_image_urls: z.array(z.string()).optional(),
});

const bodySchema = z.object({
  copy: copySchema,
  template_id: z.string().optional(),
  property_images: propertyImagesSchema.optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, report, listing } = await requireReportWithListing(id);
    const body = bodySchema.parse(await request.json());

    const parsed = listing.scraped_listing_json;
    if (!parsed || !hasSalesAppraisalComps(parsed)) {
      return NextResponse.json(
        { error: "Complete appraisal data before editing content" },
        { status: 400 },
      );
    }

    const templateId =
      body.template_id ?? report.template_id ?? undefined;
    if (!templateId || !isSalesAppraisalTemplateId(templateId)) {
      return NextResponse.json(
        { error: "Choose a sales appraisal template first" },
        { status: 400 },
      );
    }

    const agentProfile = await loadListingAgentProfile(supabase, listing);
    const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);

    const propertyImages: ReportPropertyImageSelection | undefined =
      body.property_images?.hero_image_url != null
        ? {
            hero_image_url: body.property_images.hero_image_url,
            selected_image_urls: body.property_images.selected_image_urls ?? [],
          }
        : undefined;

    const finalReportJson = rebuildSalesAppraisalFinalReport({
      agency,
      listing,
      report,
      copy: body.copy,
      agencyAgents: agentProfile
        ? [agentProfile, ...agencyAgents.filter((a) => a.id !== agentProfile.id)]
        : agencyAgents,
      templateId,
      propertyImages,
      existingFinalReport: report.final_report_json as
        | import("@/lib/types").FinalReportJson
        | null,
    });

    const { data: savedReport, error } = await supabase
      .from("reports")
      .update({
        template_id: templateId,
        final_report_json: finalReportJson,
        status: report.status === "published" ? report.status : "generated",
        generated_at: new Date().toISOString(),
      })
      .eq("id", report.id)
      .select("*")
      .single();

    if (error || !savedReport) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to save appraisal" },
        { status: 400 },
      );
    }

    return NextResponse.json({ report: savedReport, listing });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save appraisal",
      },
      { status: 400 },
    );
  }
}
