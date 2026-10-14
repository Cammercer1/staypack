import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

export function privateJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function strApiError(error: unknown) {
  unstable_rethrow(error);
  const message = error instanceof ZodError
    ? error.issues.map((issue) => issue.message).join(" ")
    : error instanceof Error ? error.message : "Unable to complete this request.";
  return privateJson({ error: message }, 400);
}
