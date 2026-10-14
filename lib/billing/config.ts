import { z } from "zod";

export function billingMode() {
  return z.enum(["disabled", "test", "live"]).parse(process.env.BILLING_MODE ?? "disabled");
}

export function billingConfig() {
  const mode = billingMode();
  if (mode === "disabled") throw new Error("Billing is not enabled yet.");
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  if (!secretKey.startsWith(mode === "live" ? "sk_live_" : "sk_test_")) {
    throw new Error("Stripe key does not match the billing environment.");
  }
  const origin = z.url().parse(process.env.BILLING_SITE_URL);
  const url = new URL(origin);
  if (url.origin !== origin || (mode === "live" && url.protocol !== "https:")) {
    throw new Error("BILLING_SITE_URL must be an origin; live billing requires HTTPS.");
  }
  return {
    livemode: mode === "live", secretKey, origin,
    accountId: z.string().regex(/^acct_[A-Za-z0-9]+$/).parse(process.env.STRIPE_ACCOUNT_ID),
  };
}
