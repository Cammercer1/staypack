import { assertRequestedCountry, AgencyCountryError } from "@/lib/property-market/agencyCountry";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import { autocompleteAddresses, completePlaceAddress } from "@/lib/geocoding/places";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suggest"), country: z.enum(["AU", "US"]).default("AU"), input: z.string().trim().min(3).max(300), sessionToken: z.string().uuid() }),
  z.object({ action: z.literal("select"), country: z.enum(["AU", "US"]).default("AU"), placeId: z.string().min(1).max(500), address: z.string().trim().min(3).max(300), sessionToken: z.string().uuid() }),
]);

export async function POST(request: Request) {
  try {
    const { agency } = await requireAgency();
    const raw = await request.json();
    const country = assertRequestedCountry(agency, raw.country);
    const body = schema.parse(raw);
    const data = body.action === "suggest"
      ? { suggestions: await autocompleteAddresses(body.input, body.sessionToken, country) }
      : { address: await completePlaceAddress(body.placeId, body.sessionToken, body.address, country) };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    unstable_rethrow(error);
    return NextResponse.json({ error: error instanceof AgencyCountryError ? error.message : "Address suggestions are unavailable. You can still type the address." }, { status: error instanceof z.ZodError || error instanceof AgencyCountryError ? 400 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
