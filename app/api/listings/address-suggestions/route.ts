import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import { autocompleteAddresses, completePlaceAddress } from "@/lib/geocoding/places";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suggest"), input: z.string().trim().min(3).max(300), sessionToken: z.string().uuid() }),
  z.object({ action: z.literal("select"), placeId: z.string().min(1).max(500), address: z.string().trim().min(3).max(300), sessionToken: z.string().uuid() }),
]);

export async function POST(request: Request) {
  try {
    await requireAgency();
    const body = schema.parse(await request.json());
    const data = body.action === "suggest"
      ? { suggestions: await autocompleteAddresses(body.input, body.sessionToken) }
      : { address: await completePlaceAddress(body.placeId, body.sessionToken, body.address) };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    unstable_rethrow(error);
    return NextResponse.json({ error: "Address suggestions are unavailable. You can still type the address." }, { status: error instanceof z.ZodError ? 400 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
