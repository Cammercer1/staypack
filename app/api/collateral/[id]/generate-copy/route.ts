import { NextResponse } from "next/server";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { buildSalesBrochureDocument } from "@/lib/collateral/buildSalesBrochureDocument";
import { provisionCollateralQr } from "@/lib/collateral/provisionCollateralQr";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import {
  SalesBrochureCopyOpenAIError,
  SalesBrochureCopyValidationError,
  generateSalesBrochureCopy,
} from "@/lib/openai/generateSalesBrochureCopy";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import type { Listing } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, collateral, listing } =
      await requireCollateralAccess(id);

    if (collateral.type !== "sales_brochure") {
      return NextResponse.json(
        { error: "Copy generation is only available for sales brochures" },
        { status: 400 },
      );
    }

    const agentProfile = await loadListingAgentProfile(supabase, listing as Listing);
    const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);
    const copy = await generateSalesBrochureCopy({
      agency,
      listing: listing as Listing,
    });

    const { provisionedListing, qrCodeUrl, qrTargetUrl } =
      await provisionCollateralQr({
        agency,
        listing: listing as Listing,
        collateral,
        supabase,
      });

    const templateId = resolveCollateralTemplateId(agency, collateral);
    const documentJson = buildSalesBrochureDocument({
      agency,
      listing: provisionedListing,
      collateral: { ...collateral, template_id: templateId },
      copy,
      agentProfile,
      agencyAgents,
      qrCodeUrl,
      qrTargetUrl,
    });

    const generatedAt = new Date().toISOString();

    const { data, error } = await supabase
      .from("collateral_items")
      .update({
        document_json: documentJson,
        template_id: templateId,
        status: "generated",
        generated_at: generatedAt,
      })
      .eq("id", collateral.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: "db_error" },
        { status: 400 },
      );
    }

    return NextResponse.json({ copy, collateral: data, listing: provisionedListing });
  } catch (error) {
    if (error instanceof SalesBrochureCopyValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }

    if (error instanceof SalesBrochureCopyOpenAIError) {
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
