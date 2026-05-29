import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth/requireUser";
import { buildBusinessCardDocument } from "@/lib/collateral/buildBusinessCardDocument";
import { BUSINESS_CARD_CLASSIC_TEMPLATE_ID } from "@/lib/collateral/templates/ids";
import { createBusinessCardSchema } from "@/lib/validation/schemas";
import type { AgentProfile, CollateralItem } from "@/lib/types";

export async function GET() {
  try {
    const { supabase, agency } = await requireAgency();
    const { data, error } = await supabase
      .from("collateral_items")
      .select("*")
      .eq("agency_id", agency.id)
      .eq("type", "agent_business_card")
      .is("listing_id", null)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ collateral: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load business cards",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, agency } = await requireAgency();
    const body = createBusinessCardSchema.parse(await request.json());

    const { data: agents, error: agentsError } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("agency_id", agency.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (agentsError) {
      return NextResponse.json({ error: agentsError.message }, { status: 400 });
    }

    const agencyAgents = (agents ?? []) as AgentProfile[];
    const agentProfile =
      (body.agent_profile_id
        ? agencyAgents.find((agent) => agent.id === body.agent_profile_id)
        : null) ??
      agencyAgents.find((agent) => agent.is_default) ??
      agencyAgents[0] ??
      null;

    const { data: created, error } = await supabase
      .from("collateral_items")
      .insert({
        listing_id: null,
        agency_id: agency.id,
        type: "agent_business_card",
        status: "generated",
        template_id: BUSINESS_CARD_CLASSIC_TEMPLATE_ID,
      })
      .select("*")
      .single();

    if (error || !created) {
      const isMissingAgencyCardMigration =
        error?.code === "23502" &&
        error.message.includes("listing_id") &&
        error.message.includes("not-null");

      return NextResponse.json(
        {
          error: isMissingAgencyCardMigration
            ? "Business cards need the latest database migration. Apply supabase/migrations/020_agency_business_cards.sql, then try again."
            : error?.message ?? "Unable to create business card",
        },
        { status: 400 },
      );
    }

    const collateral = created as CollateralItem;
    const documentJson = buildBusinessCardDocument({
      agency,
      collateral,
      agentProfile,
      agencyAgents,
    });

    const { data: updated, error: updateError } = await supabase
      .from("collateral_items")
      .update({
        document_json: documentJson,
        generated_at: documentJson.generated_at,
      })
      .eq("id", collateral.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ collateral: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create business card",
      },
      { status: 400 },
    );
  }
}
