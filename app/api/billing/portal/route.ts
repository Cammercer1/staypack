import { requireAgencyAdmin } from "@/lib/auth/requireUser";
import { createBillingPortal } from "@/lib/billing/server";
import { billingMode } from "@/lib/billing/config";
import { assertBillingOrigin, billingError, billingJson } from "@/lib/billing/http";

export async function POST(request: Request) {
  if (billingMode() === "disabled") return billingJson({ error: "Billing disabled" }, 503);
  try {
    const { agency } = await requireAgencyAdmin();
    assertBillingOrigin(request);
    return billingJson({ url: await createBillingPortal(agency.id) });
  } catch (error) { return billingError(error); }
}
