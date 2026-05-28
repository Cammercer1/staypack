import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, listing } = await requireListingAccess(id);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("listing_id", listing.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ leads: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load leads" },
      { status: 400 },
    );
  }
}
