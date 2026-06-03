import { NextResponse } from "next/server";
import { assertDeliveryCronAuth } from "@/lib/delivery/auth/cronSecret";
import {
  listDeliveryTenants,
  upsertDeliveryTenant,
} from "@/lib/delivery/tenants/repository";
import { deliveryTenantSchema } from "@/lib/delivery/tenants/schema";

export async function GET(request: Request) {
  try {
    assertDeliveryCronAuth(request);
    const tenants = await listDeliveryTenants();
    return NextResponse.json({ tenants });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    assertDeliveryCronAuth(request);
    const body = deliveryTenantSchema.parse(await request.json());
    const tenant = await upsertDeliveryTenant(body);
    return NextResponse.json({ tenant });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
