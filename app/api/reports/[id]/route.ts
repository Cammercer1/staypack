import { invalidateReportPdf, preserveReportImages } from "@/lib/reports/invalidateReportPdf";
import { preserveDocumentLink } from "@/lib/documents/documentLink";
import { NextResponse } from "next/server";
import { requireReportWithListing } from "@/lib/auth/requireUser";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { normalizeAiCopy } from "@/lib/reports/normalizeAiCopy";
import { enforceTemplateCopyLimits } from "@/lib/reports/enforceTemplateCopyLimits";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { DEFAULT_REPORT_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { assertTemplateGranted } from "@/lib/templates/grants/assertTemplateGranted";
import { templateGrantErrorResponse } from "@/lib/templates/grants/apiErrors";
import { aiCopySchema, updateReportSchema, type UpdateReportInput } from "@/lib/validation/schemas";
import type { Agency, AiCopyJson, Listing, Report } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectStrComps } from "@/lib/str/comparables";
import { applyStrEstimateAdjustments, reconcileStrEstimate, saveStrRateOverride } from "@/lib/reports/strEstimateAdjustments";
import { finalReportCopyToAiCopy } from "@/lib/reports/editable/strReportCopyAdapter";

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
  const reportForBuild = {
    ...report,
    ...(body as Partial<Report>),
  };
  const estimate = resolveReportEstimate(reportForBuild);

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
    report: reportForBuild,
    estimate,
    copy,
    scraped: listing.scraped_listing_json,
    propertyImages: preserveReportImages(report.final_report_json),
  });
  body.status = report.status === "published" ? "published" : "generated";

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
    const { supabase, agency, report: storedReport, listing } = await requireReportWithListing(id);
    const body = updateReportSchema.parse(await request.json());
    const adjustment = body.str_adjustment;
    delete body.str_adjustment;
    if (adjustment) {
      if (body.final_estimate_json || body.user_overrides_json || body.final_report_json) {
        throw new Error("Send ADR and occupancy only; report figures are calculated on the server.");
      }
      const baseline = storedReport.original_estimate_json;
      if (!baseline) throw new Error("Get a market estimate before adjusting the figures.");
      const rates = adjustment.mode !== "baseline"
        ? { nightlyRate: adjustment.nightlyRate, occupancyRate: adjustment.occupancyRate }
        : null;
      body.final_estimate_json = rates
        ? applyStrEstimateAdjustments(baseline, rates)
        : reconcileStrEstimate(baseline);
      body.user_overrides_json = saveStrRateOverride(storedReport.user_overrides_json, rates,
        adjustment.mode === "management" ? adjustment.assumptions : null);
    }
    const selectedIds = body.selected_comp_listing_ids;
    delete body.selected_comp_listing_ids;
    if (selectedIds && !storedReport.str_enrichment_json) throw new Error("Fetch comparable evidence before selecting listings");
    const selectedEnrichment = selectedIds ? selectStrComps(storedReport.str_enrichment_json!, selectedIds) : null;
    const report = selectedEnrichment ? { ...storedReport, str_enrichment_json: selectedEnrichment } : storedReport;
    const savedCopy = report.ai_copy_json ?? (report.final_report_json
      ? finalReportCopyToAiCopy(report.final_report_json.copy, null) : null);

    if (body.template_id) {
      try {
        await assertTemplateGranted(agency, body.template_id);
      } catch (grantError) {
        const denied = templateGrantErrorResponse(grantError);
        if (denied) {
          return denied;
        }
        throw grantError;
      }
    }

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
    } else if ((body.final_estimate_json !== undefined || selectedEnrichment) && savedCopy) {
      const rebuildResult = await rebuildFinalReportJson({
        supabase,
        agency,
        listing,
        report,
        body,
        copy: savedCopy,
      });

      if (rebuildResult.error) {
        return rebuildResult.error;
      }
    }

    if (selectedEnrichment && !body.final_report_json && report.final_report_json) {
      body.final_report_json = { ...report.final_report_json, str_enrichment: selectedEnrichment };
    }

    if (body.template_id && body.template_id !== report.template_id && !body.final_report_json && report.final_report_json) {
      body.final_report_json = { ...report.final_report_json, template_id: body.template_id };
    }

    if (body.final_report_json) {
      body.final_report_json = { ...body.final_report_json, ...preserveDocumentLink(report.final_report_json) };
    }

    const { data, error } = await supabase
      .from("reports")
      .update({
        ...body,
        ...(selectedEnrichment ? { str_enrichment_json: selectedEnrichment } : {}),
        ...(adjustment ? { pdf_url: null } : {}),
        ...(body.final_report_json ? {
          final_report_json: invalidateReportPdf(body.final_report_json),
          pdf_url: null,
        } : {}),
      })
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
