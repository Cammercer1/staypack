import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { billingConfig } from "./config";

export function billingJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function assertBillingOrigin(request: Request) {
  if (request.headers.get("origin") !== billingConfig().origin) throw new Error("Invalid request origin");
}

export function billingError(error: unknown) {
  unstable_rethrow(error);
  // Do not expose Stripe, database or credential diagnostics to customers.
  if (error instanceof Error && error.message === "Admin access required") return billingJson({ error: "Only agency owners and admins can manage billing." }, 403);
  console.error("Billing request failed", error instanceof Error ? error.name : "Unknown error");
  return billingJson({ error: "Billing could not be updated. Please try again or contact support." }, 400);
}
