export default async function handler() {
  if (!process.env.BILLING_MODE || process.env.BILLING_MODE === "disabled") return new Response(null, { status: 204 });
  const origin = process.env.BILLING_SITE_URL;
  const secret = process.env.BILLING_CRON_SECRET;
  if (!origin || !secret) throw new Error("Billing usage sync is not configured");
  const response = await fetch(new URL("/api/billing/usage-sync", origin), {
    method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Billing usage sync returned ${response.status}`);
  const result = await response.json();
  if (result.retrying || result.needsReview) throw new Error("Billing usage needs attention; inspect the usage ledger");
  return new Response(null, { status: 204 });
}

export const config = { schedule: "* * * * *" };
