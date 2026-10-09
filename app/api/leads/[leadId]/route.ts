import { LEGACY_PROPERTY_PAGE_TOOLS } from "@/lib/listings/legacyPropertyPages";
import { NextResponse } from "next/server";
import { requireAgency } from "@/lib/auth/requireUser";
import { updateLeadSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  if (!LEGACY_PROPERTY_PAGE_TOOLS) return NextResponse.json({ error: "Property pages and enquiry management have been retired. Contact the agent directly." }, { status: 410 });
  try {
    const { leadId } = await params;
    const { supabase, agency } = await requireAgency();
    const body = updateLeadSchema.parse(await request.json());

    const { data, error } = await supabase
      .from("leads")
      .update({ status: body.status })
      .eq("id", leadId)
      .eq("agency_id", agency.id)
      .select("*, listings(id, listing_title, property_address, public_slug, status)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ lead: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update lead",
      },
      { status: 400 },
    );
  }
}
