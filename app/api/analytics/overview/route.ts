import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth/requireUser";

export async function GET(request: Request) {
  try {
    const { supabase, agency } = await requireAgency();
    const { searchParams } = new URL(request.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to query params are required (ISO date strings)" },
        { status: 400 },
      );
    }

    const [{ count: views }, { count: leads }] = await Promise.all([
      supabase
        .from("listing_page_views")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agency.id)
        .gte("created_at", from)
        .lte("created_at", to),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agency.id)
        .gte("created_at", from)
        .lte("created_at", to),
    ]);

    return NextResponse.json({
      views: views ?? 0,
      leads: leads ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
