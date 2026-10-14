import Stripe from "stripe";
import { billingConfig } from "./config";

/** Pin webhook destinations to this version as well. */
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;

export async function billingStripe() {
  const config = billingConfig();
  const stripe = new Stripe(config.secretKey, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 20_000 });
  // A valid key from another business is still the wrong key.
  const account = await stripe.accounts.retrieve(config.accountId);
  if (account.id !== config.accountId) throw new Error("Stripe account does not match StayPack billing configuration.");
  return stripe;
}
