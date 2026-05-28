import { NextResponse } from "next/server";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import {
  CopyOpenAIError,
  CopyValidationError,
  generateReportCopy,
} from "@/lib/openai/generateReportCopy";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { resolveReportTemplateId } from "@/lib/reports/templates/resolveTemplateId";
import { generateCopyRequestSchema } from "@/lib/validation/schemas";
import type { Report } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, report, listing } = await requireReportWithListing(id);
    const body = generateCopyRequestSchema.parse(
      await request.json().catch(() => ({})),
    );

    const estimate = resolveReportEstimate(report);

    if (!estimate) {
      return NextResponse.json(
        {
          error: "Run an STR estimate before generating copy",
          code: "missing_estimate",
        },
        { status: 400 },
      );
    }

    const reportForBuild: Report = body.template_id
      ? { ...report, template_id: body.template_id }
      : report;
    const templateId = resolveReportTemplateId(agency, reportForBuild);

    const agentProfile = await loadListingAgentProfile(supabase, listing);
    const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);
    const copy = await generateReportCopy({
      agency,
      listing,
      report: reportForBuild,
      estimate,
    });
    const finalReportJson = buildFinalReportJson({
      agency,
      agentProfile,
      agencyAgents,
      listing,
      report: reportForBuild,
      estimate,
      copy,
      scraped: listing.scraped_listing_json,
    });

    const { data, error } = await supabase
      .from("reports")
      .update({
        template_id: templateId,
        ai_copy_json: copy,
        final_report_json: finalReportJson,
        status: "generated",
        generated_at: new Date().toISOString(),
      })
      .eq("id", report.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: "db_error" },
        { status: 400 },
      );
    }

    return NextResponse.json({ copy, report: data, listing });
  } catch (error) {
    if (error instanceof CopyValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }

    if (error instanceof CopyOpenAIError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Copy generation failed",
        code: "openai_error",
      },
      { status: 400 },
    );
  }
}
