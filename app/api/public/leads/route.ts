import { LEGACY_PROPERTY_PAGE_TOOLS } from "@/lib/listings/legacyPropertyPages";
import { NextResponse } from "next/server";
import { resolveAgencyBySlug } from "@/lib/agencies/resolveAgencyBySlug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicLeadSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  if (!LEGACY_PROPERTY_PAGE_TOOLS) return NextResponse.json({ error: "Property pages and enquiry management have been retired. Contact the agent directly." }, { status: 410 });
  try {
    const body = createPublicLeadSchema.parse(await request.json());
    const admin = createAdminClient();

    let agency;
    try {
      agency = await resolveAgencyBySlug(admin, body.agency_slug);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unable to load agency",
        },
        { status: 400 },
      );
    }

    if (!agency) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id, agency_id, status")
      .eq("agency_id", agency.id)
      .eq("public_slug", body.listing_slug)
      .eq("status", "active")
      .maybeSingle();

    if (listingError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .insert({
        listing_id: listing.id,
        agency_id: listing.agency_id,
        name: body.name,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        status: "new",
        source: "landing_page",
      })
      .select("*")
      .single();

    if (leadError) {
      return NextResponse.json({ error: leadError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, lead_id: lead.id });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to submit enquiry",
      },
      { status: 400 },
    );
  }
}
