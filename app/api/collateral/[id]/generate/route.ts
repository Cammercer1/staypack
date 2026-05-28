import { NextResponse } from "next/server";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { generateCollateralDocument } from "@/lib/collateral/generateCollateralDocument";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, listing, collateral } =
      await requireCollateralAccess(id);

    if (collateral.type === "str_report") {
      return NextResponse.json(
        { error: "Use the Short-Term Rental Report flow for this collateral type" },
        { status: 400 },
      );
    }

    const photoError = collateralPhotoRequirementError(listing);
    if (photoError) {
      return NextResponse.json({ error: photoError }, { status: 400 });
    }

    const { data: agencyAgents } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("agency_id", agency.id);

    const agentProfile =
      listing.agent_profile_id != null
        ? agencyAgents?.find((agent) => agent.id === listing.agent_profile_id) ??
          null
        : null;

    const documentJson = await generateCollateralDocument({
      agency,
      listing,
      collateral,
      supabase,
      agentProfile,
      agencyAgents: agencyAgents ?? [],
    });

    const templateId = resolveCollateralTemplateId(agency, collateral);
    const generatedAt = new Date().toISOString();

    const { data, error } = await supabase
      .from("collateral_items")
      .update({
        document_json: documentJson,
        template_id: templateId,
        qr_code_url: documentJson.assets.qr_code_url,
        status: "generated",
        generated_at: generatedAt,
      })
      .eq("id", collateral.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ collateral: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to generate collateral",
      },
      { status: 400 },
    );
  }
}
