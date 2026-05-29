import { NextResponse } from "next/server";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { normalizeAiCopy } from "@/lib/reports/normalizeAiCopy";
import { enforceTemplateCopyLimits } from "@/lib/reports/enforceTemplateCopyLimits";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { DEFAULT_REPORT_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { aiCopySchema, updateReportSchema, type UpdateReportInput } from "@/lib/validation/schemas";
import type { Agency, AiCopyJson, Listing, Report } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

async function rebuildFinalReportJson({
  supabase,
  agency,
  listing,
  report,
  body,
  copy,
}: {
  supabase: SupabaseClient;
  agency: Agency;
  listing: Listing;
  report: Report;
  body: UpdateReportInput;
  copy: AiCopyJson;
}) {
  const estimate = resolveReportEstimate(report);

  if (!estimate) {
    return {
      error: NextResponse.json(
        {
          error: "Run an STR estimate before updating the report",
          code: "missing_estimate",
        },
        { status: 400 },
      ),
    };
  }

  const agentProfile = await loadListingAgentProfile(supabase, listing);
  const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);
  body.final_report_json = buildFinalReportJson({
    agency,
    agentProfile,
    agencyAgents,
    listing,
    report: {
      ...report,
      ...(body as Partial<Report>),
    },
    estimate,
    copy,
    scraped: listing.scraped_listing_json,
  });
  body.status = "generated";

  return { error: null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { report, listing } = await requireReportWithListing(id);
    return NextResponse.json({ report, listing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load report" },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, report, listing } = await requireReportWithListing(id);
    const body = updateReportSchema.parse(await request.json());

    if (body.ai_copy_json) {
      const parsedCopy = aiCopySchema.safeParse(
        normalizeAiCopy(body.ai_copy_json, agency),
      );

      if (!parsedCopy.success) {
        return NextResponse.json(
          {
            error: "Copy fields are invalid",
            code: "validation_failed",
          },
          { status: 400 },
        );
      }

      const limitedCopy = enforceTemplateCopyLimits(
        parsedCopy.data,
        body.template_id ??
          report.template_id ??
          agency.report_template_id ??
          DEFAULT_REPORT_TEMPLATE_ID,
      );

      body.ai_copy_json = limitedCopy;
      const rebuildResult = await rebuildFinalReportJson({
        supabase,
        agency,
        listing,
        report,
        body,
        copy: limitedCopy,
      });

      if (rebuildResult.error) {
        return rebuildResult.error;
      }
    } else if (
      body.template_id !== undefined &&
      report.ai_copy_json &&
      body.template_id !== report.template_id
    ) {
      const rebuildResult = await rebuildFinalReportJson({
        supabase,
        agency,
        listing,
        report,
        body,
        copy: report.ai_copy_json,
      });

      if (rebuildResult.error) {
        return rebuildResult.error;
      }
    }

    const { data, error } = await supabase
      .from("reports")
      .update(body)
      .eq("id", report.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ report: data, listing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update report" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, report } = await requireReportWithListing(id);

    const { error } = await supabase
      .from("reports")
      .update({ status: "archived" })
      .eq("id", report.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete report" },
      { status: 400 },
    );
  }
}
