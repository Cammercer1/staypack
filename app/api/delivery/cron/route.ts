import { NextResponse } from "next/server";
import { assertDeliveryCronAuth } from "@/lib/delivery/auth/cronSecret";
import { runTenantDelivery } from "@/lib/delivery/orchestrator/runTenantDelivery";
import { listDeliveryTenants } from "@/lib/delivery/tenants/repository";
import { listDueTenants } from "@/lib/delivery/tenants/scrapeSchedule";

export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    assertDeliveryCronAuth(request);

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "1";

    const tenants = await listDeliveryTenants();
    const due = force ? tenants.filter((t) => t.enabled && t.scrape_enabled) : listDueTenants(tenants);

    const results = [];

    for (const tenant of due) {
      results.push(await runTenantDelivery(tenant));
    }

    return NextResponse.json({
      dueCount: due.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
