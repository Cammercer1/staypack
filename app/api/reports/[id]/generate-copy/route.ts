import { NextResponse } from "next/server";
import { requireReportAccess } from "@/lib/auth/requireUser";
import {
  CopyOpenAIError,
  CopyValidationError,
  generateReportCopy,
} from "@/lib/openai/generateReportCopy";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { loadReportAgent } from "@/lib/reports/loadReportAgent";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, report } = await requireReportAccess(id);

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

    const agent = await loadReportAgent(supabase, report);
    const copy = await generateReportCopy({ agency, report, estimate });
    const finalReportJson = buildFinalReportJson({
      agency,
      agent,
      report,
      estimate,
      copy,
      scraped: report.scraped_listing_json,
    });

    const { data, error } = await supabase
      .from("reports")
      .update({
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

    return NextResponse.json({ copy, report: data });
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
