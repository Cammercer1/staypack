import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { finalReportCopyToAiCopy } from "@/lib/reports/editable/strReportCopyAdapter";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { enforceTemplateCopyLimits } from "@/lib/reports/enforceTemplateCopyLimits";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { DEFAULT_REPORT_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { assertTemplateGranted } from "@/lib/templates/grants/assertTemplateGranted";
import { templateGrantErrorResponse } from "@/lib/templates/grants/apiErrors";
import type { ReportPropertyImageSelection } from "@/lib/reports/editable/reportImageSlots";
import type { FinalReportJson } from "@/lib/types";

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
  comparable_evidence: z.string().optional().default(""),
  comparable_disclaimer: z.string().optional().default(""),
  cta: z.string().optional().default(""),
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

    const estimate = resolveReportEstimate(report);
    if (!estimate) {
      return NextResponse.json(
        {
          error: "Run an STR estimate before editing content",
          code: "missing_estimate",
        },
        { status: 400 },
      );
    }

    const templateId =
      body.template_id ??
      report.template_id ??
      agency.report_template_id ??
      DEFAULT_REPORT_TEMPLATE_ID;

    try {
      await assertTemplateGranted(agency.id, templateId);
    } catch (grantError) {
      const denied = templateGrantErrorResponse(grantError);
      if (denied) {
        return denied;
      }
      throw grantError;
    }

    const aiCopy = enforceTemplateCopyLimits(
      finalReportCopyToAiCopy(body.copy, report.ai_copy_json),
      templateId,
    );

    const propertyImages: ReportPropertyImageSelection | undefined =
      body.property_images?.hero_image_url != null
        ? {
            hero_image_url: body.property_images.hero_image_url,
            selected_image_urls: body.property_images.selected_image_urls ?? [],
          }
        : undefined;

    const agentProfile = await loadListingAgentProfile(supabase, listing);
    const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);

    const existingFinal = report.final_report_json as FinalReportJson | null;
    const finalReportJson = buildFinalReportJson({
      agency,
      agentProfile,
      agencyAgents,
      listing,
      report: { ...report, template_id: templateId },
      estimate,
      copy: aiCopy,
      scraped: listing.scraped_listing_json,
      propertyImages:
        propertyImages ??
        (existingFinal?.property
          ? {
              hero_image_url: existingFinal.property.hero_image_url,
              selected_image_urls: existingFinal.property.selected_image_urls,
            }
          : null),
    });

    const { data: savedReport, error } = await supabase
      .from("reports")
      .update({
        template_id: templateId,
        ai_copy_json: aiCopy,
        final_report_json: finalReportJson,
        status: report.status === "published" ? report.status : "generated",
        generated_at: new Date().toISOString(),
      })
      .eq("id", report.id)
      .select("*")
      .single();

    if (error || !savedReport) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to save report" },
        { status: 400 },
      );
    }

    return NextResponse.json({ report: savedReport, listing });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save report",
      },
      { status: 400 },
    );
  }
}
