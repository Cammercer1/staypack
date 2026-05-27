import { NextResponse } from "next/server";
import { requireReportAccess } from "@/lib/auth/requireUser";
import { geocodeReportAddress, hasGeocodableAddress } from "@/lib/geocoding";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { loadReportAgentProfile } from "@/lib/reports/loadReportAgent";
import { normalizeAiCopy } from "@/lib/reports/normalizeAiCopy";
import { resolveReportEstimate } from "@/lib/reports/normalizeEstimate";
import { aiCopySchema, parsedListingSchema, updateReportSchema, type UpdateReportInput } from "@/lib/validation/schemas";
import type { Agency, AiCopyJson, Report } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const ADDRESS_FIELDS = [
  "property_address",
  "suburb",
  "state",
  "postcode",
  "country",
] as const;

async function rebuildFinalReportJson({
  supabase,
  agency,
  report,
  body,
  copy,
}: {
  supabase: SupabaseClient;
  agency: Agency;
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

  const agentProfile = await loadReportAgentProfile(supabase, report);
  body.final_report_json = buildFinalReportJson({
    agency,
    agentProfile,
    report: {
      ...report,
      ...(body as Partial<Report>),
    },
    estimate,
    copy,
    scraped: report.scraped_listing_json,
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
    const { report } = await requireReportAccess(id);
    return NextResponse.json({ report });
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
    const { supabase, agency, report } = await requireReportAccess(id);
    const body = updateReportSchema.parse(await request.json());

    if (body.listing_agents !== undefined) {
      const currentScraped = parsedListingSchema.parse(
        report.scraped_listing_json ?? {
          images: [],
          agents: [],
          confidence: "low",
          warnings: [],
        },
      );
      const listingAgents = body.listing_agents
        .map((agent) => ({
          name: agent.name.trim(),
          email: agent.email?.trim() || undefined,
          phone: agent.phone?.trim() || undefined,
          role_title: agent.role_title?.trim() || undefined,
          photo_url: agent.photo_url?.trim() || undefined,
        }))
        .filter((agent) => agent.name);

      body.scraped_listing_json = {
        ...currentScraped,
        agents: listingAgents,
      };
      delete body.listing_agents;
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

      body.ai_copy_json = parsedCopy.data;
      const rebuildResult = await rebuildFinalReportJson({
        supabase,
        agency,
        report,
        body,
        copy: parsedCopy.data,
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
        report,
        body,
        copy: report.ai_copy_json,
      });

      if (rebuildResult.error) {
        return rebuildResult.error;
      }
    }

    const nextReport = {
      property_address: body.property_address ?? report.property_address,
      suburb: body.suburb ?? report.suburb,
      state: body.state ?? report.state,
      postcode: body.postcode ?? report.postcode,
      country: body.country ?? report.country,
    };

    const addressChanged = ADDRESS_FIELDS.some((field) => field in body);
    let geocodeWarning: string | undefined;

    if (
      addressChanged &&
      hasGeocodableAddress(nextReport) &&
      (body.latitude == null || body.longitude == null)
    ) {
      try {
        const geocoded = await geocodeReportAddress(nextReport);
        body.latitude = geocoded.latitude;
        body.longitude = geocoded.longitude;
      } catch (error) {
        geocodeWarning =
          error instanceof Error
            ? error.message
            : "Unable to geocode property address";
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

    return NextResponse.json({
      report: data,
      geocode_warning: geocodeWarning,
    });
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
    const { supabase, report } = await requireReportAccess(id);

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
