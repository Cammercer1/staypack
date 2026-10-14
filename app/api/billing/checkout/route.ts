import { z } from "zod";
import { requireAgencyAdmin } from "@/lib/auth/requireUser";
import { createBillingCheckout } from "@/lib/billing/server";
import { billingMode } from "@/lib/billing/config";
import { assertBillingOrigin, billingError, billingJson } from "@/lib/billing/http";

export async function POST(request: Request) {
  if (billingMode() === "disabled") return billingJson({ error: "Billing disabled" }, 503);
  try {
    const { agency } = await requireAgencyAdmin();
    assertBillingOrigin(request);
    const { planId } = z.object({ planId: z.string().min(1).max(80) }).strict().parse(await request.json());
    return billingJson({ url: await createBillingCheckout(agency, planId) });
  } catch (error) { return billingError(error); }
}
