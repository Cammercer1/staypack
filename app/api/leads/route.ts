import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth/requireUser";

export async function GET() {
  try {
    const { supabase, agency } = await requireAgency();

    const { data, error } = await supabase
      .from("leads")
      .select(
        "*, listings(id, listing_title, property_address, public_slug, status)",
      )
      .eq("agency_id", agency.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ leads: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load leads",
      },
      { status: 400 },
    );
  }
}
