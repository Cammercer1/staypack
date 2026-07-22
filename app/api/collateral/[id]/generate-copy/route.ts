import { NextResponse } from "next/server";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import {
  buildRentalBrochureDocument,
  buildSalesBrochureDocument,
} from "@/lib/collateral/buildSalesBrochureDocument";
import { withBrochureContentSaved } from "@/lib/collateral/sales-brochure/brochurePublishSync";
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import { provisionCollateralQr } from "@/lib/collateral/provisionCollateralQr";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";
import { assertTemplateGranted } from "@/lib/templates/grants/assertTemplateGranted";
import { templateGrantErrorResponse } from "@/lib/templates/grants/apiErrors";
import {
  SalesBrochureCopyOpenAIError,
  SalesBrochureCopyValidationError,
  generateSalesBrochureCopy,
} from "@/lib/openai/generateSalesBrochureCopy";
import {
  RentalBrochureCopyOpenAIError,
  RentalBrochureCopyValidationError,
  generateRentalBrochureCopy,
} from "@/lib/openai/generateRentalBrochureCopy";
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

    if (collateral.type !== "sales_brochure" && collateral.type !== "rental_brochure") {
      return NextResponse.json(
        { error: "Copy generation is only available for brochures" },
        { status: 400 },
      );
    }

    const agentProfile = await loadListingAgentProfile(supabase, listing as Listing);
    const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);
    const copy =
      collateral.type === "rental_brochure"
        ? await generateRentalBrochureCopy({
            agency,
            listing: listing as Listing,
          })
        : await generateSalesBrochureCopy({
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
    try {
      await assertTemplateGranted(agency, templateId);
    } catch (grantError) {
      const denied = templateGrantErrorResponse(grantError);
      if (denied) {
        return denied;
      }
      throw grantError;
    }
    const built =
      collateral.type === "rental_brochure"
        ? buildRentalBrochureDocument({
            agency,
            listing: provisionedListing,
            collateral: { ...collateral, template_id: templateId },
            copy,
            agentProfile,
            agencyAgents,
            qrCodeUrl,
            qrTargetUrl,
          })
        : buildSalesBrochureDocument({
            agency,
            listing: provisionedListing,
            collateral: { ...collateral, template_id: templateId },
            copy,
            agentProfile,
            agencyAgents,
            qrCodeUrl,
            qrTargetUrl,
          });

    const existing = collateral.document_json;
    const documentJson = withBrochureContentSaved(
      existing && isBrochureDocument(existing)
        ? {
            ...built,
            property: {
              ...built.property,
              hero_image_url: existing.property.hero_image_url,
              selected_image_urls: existing.property.selected_image_urls,
              page_one_image_urls: existing.property.page_one_image_urls,
              page_two_image_urls: existing.property.page_two_image_urls,
            },
          }
        : built,
    );

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
    if (
      error instanceof SalesBrochureCopyValidationError ||
      error instanceof RentalBrochureCopyValidationError
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }

    if (
      error instanceof SalesBrochureCopyOpenAIError ||
      error instanceof RentalBrochureCopyOpenAIError
    ) {
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
