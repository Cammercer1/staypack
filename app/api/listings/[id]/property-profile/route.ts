import { assertPropertyCountry } from "@/lib/property-market/agencyCountry";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { hasFreshPropertyProfile, refreshPropertyProfile } from "@/lib/domain-avm/refreshPropertyProfile";
import { userFacingPropertyMessage } from "@/lib/listings/userFacingPropertyMessages";

export const maxDuration = 60;
const inputSchema = z.object({ refresh: z.boolean().default(false) });
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, listing, agency } = await requireListingAccess(id);
    assertPropertyCountry(agency, listing);
    const input = inputSchema.parse(await request.json());
    if (listing.status === "archived") return NextResponse.json({ error: "Restore this property before refreshing it." }, { status: 409, headers });
    if (!input.refresh && hasFreshPropertyProfile(listing)) return NextResponse.json({ listing, cached: true }, { headers });
    const scraped = await refreshPropertyProfile(listing);
    const { data, error } = await supabase.from("listings")
      .update({ scraped_listing_json: scraped })
      .eq("id", listing.id).eq("agency_id", listing.agency_id).eq("updated_at", listing.updated_at)
      .select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "The property changed while details were loading. Refresh the page to use the latest details." }, { status: 409, headers });
    return NextResponse.json({ listing: data, cached: false }, { headers });
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : "Property details are unavailable. You can enter them manually.";
    if (/429|quota/i.test(message)) return NextResponse.json({ error: "Property lookup is temporarily unavailable. Use the saved details or enter the figures and amenities manually." }, { status: 429, headers });
    if (/Domain AVM request failed/i.test(message)) return NextResponse.json({ error: "Property lookup is temporarily unavailable. You can enter the figures and amenities manually." }, { status: 502, headers });
    return NextResponse.json({ error: userFacingPropertyMessage(message) }, { status: 400, headers });
  }
}
