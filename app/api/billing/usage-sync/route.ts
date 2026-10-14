import { timingSafeEqual } from "node:crypto";
import { billingMode } from "@/lib/billing/config";
import { billingJson } from "@/lib/billing/http";
import { dispatchUsage } from "@/lib/billing/usage";

export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.BILLING_CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return billingJson({ error: "Unauthorized" }, 401);
  if (billingMode() === "disabled") return billingJson({ skipped: true });
  try { return billingJson(await dispatchUsage()); }
  catch { return billingJson({ error: "Usage sync failed" }, 500); }
}
