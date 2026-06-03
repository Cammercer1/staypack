import { NextResponse } from "next/server";
import { assertDeliveryCronAuth } from "@/lib/delivery/auth/cronSecret";
import { getDeliveryTenantBySlug } from "@/lib/delivery/tenants/repository";
import { rollupTenantUsage } from "@/lib/delivery/usage/events";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    assertDeliveryCronAuth(request);
    const { tenantSlug } = await params;
    const tenant = await getDeliveryTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const period =
      searchParams.get("period") ??
      new Date().toISOString().slice(0, 7);

    const rollup = await rollupTenantUsage(tenant.id, period);
    const included = tenant.billing.includedDeliveriesPerMonth ?? 0;
    const overage = Math.max(0, rollup.deliveriesSent - included);
    const overageCents =
      (tenant.billing.overagePricePerDeliveryCents ?? 0) * overage;

    return NextResponse.json({
      rollup,
      billing: {
        includedDeliveriesPerMonth: included,
        overageDeliveries: overage,
        estimatedOverageCents: overageCents,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
