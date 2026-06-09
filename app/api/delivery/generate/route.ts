import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { assertDeliveryCronAuth } from "@/lib/delivery/auth/cronSecret";
import { generateOutreachBundle } from "@/lib/delivery/outreach/generateOutreachBundle";
import { outreachGenerateRequestSchema } from "@/lib/delivery/outreach/schema";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    assertDeliveryCronAuth(request);

    const body = outreachGenerateRequestSchema.parse(await request.json());
    const result = await generateOutreachBundle(body);

    const status = result.artifacts.length > 0 ? 200 : 502;

    return NextResponse.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generate failed";
    const status =
      message === "Unauthorized" ? 401 : error instanceof ZodError ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
