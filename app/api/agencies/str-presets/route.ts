import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/auth/requireUser";
import { strManagementPresetsSchema, strManagementAssumptionsSchema, strUpliftPercentSchema } from "@/lib/reports/strEstimateAdjustments";
import { z } from "zod";

const schema = z.object({ presets: strManagementPresetsSchema }).strict();

/** First-use setup only. Never overwrite a default created in another tab. */
export async function POST(request: Request) {
  try {
    const { supabase, agency } = await requireAgencyAdmin();
    const input = z.object({ upliftPercent: strUpliftPercentSchema, assumptions: strManagementAssumptionsSchema }).strict().parse(await request.json());
    const current = strManagementPresetsSchema.parse(agency.str_management_presets ?? []);
    if (current.some((preset) => preset.isDefault) || current.length >= 5) {
      return NextResponse.json({ error: "Company presets have already been set up. Review them in company settings." }, { status: 409 });
    }
    const { unavailableNights, listingStage, rationale } = input.assumptions;
    const presets = strManagementPresetsSchema.parse([...current, {
      id: crypto.randomUUID(), name: "Company management uplift", mode: "uplift", isDefault: true,
      upliftPercent: input.upliftPercent, assumptions: { unavailableNights, listingStage, rationale },
    }]);
    const { data, error } = await supabase.from("agencies")
      .update({ str_management_presets: presets }).eq("id", agency.id)
      .eq("str_management_presets", JSON.stringify(agency.str_management_presets ?? []))
      .select("str_management_presets").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Company settings changed while you were editing. Reload before setting the default." }, { status: 409 });
    return NextResponse.json({ presets: data.str_management_presets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save company default" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, agency } = await requireAgencyAdmin();
    const { presets } = schema.parse(await request.json());
    const { data, error } = await supabase.from("agencies")
      .update({ str_management_presets: presets }).eq("id", agency.id)
      .select("str_management_presets").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ presets: data.str_management_presets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save company presets" }, { status: 400 });
  }
}
