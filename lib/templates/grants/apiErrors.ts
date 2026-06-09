import { NextResponse } from "next/server";
import { TemplateNotGrantedError } from "@/lib/templates/grants/assertTemplateGranted";

export function templateGrantErrorResponse(error: unknown) {
  if (error instanceof TemplateNotGrantedError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 403 },
    );
  }
  return null;
}
