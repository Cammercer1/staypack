import { NextResponse } from "next/server";
import { assertDeliveryCronAuth } from "@/lib/delivery/auth/cronSecret";
import { runTenantDelivery } from "@/lib/delivery/orchestrator/runTenantDelivery";
import { getDeliveryTenantBySlug } from "@/lib/delivery/tenants/repository";

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertDeliveryCronAuth(request);
    const { slug } = await params;
    const tenant = await getDeliveryTenantBySlug(slug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const summary = await runTenantDelivery(tenant);

    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
