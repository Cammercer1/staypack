# StayPack billing infrastructure

**Implementation status:** Billing is disabled. The following describes the original AUD plan foundation; the calculator pricing decision below supersedes its calculator rate.

The original plan bills each agency through one shared monthly subscription. The base fee is paid upfront; completed standalone calculator estimates and first-published reports consume separate included allowances, with excess usage invoiced in arrears. Team members share the same allowances. The agreed plan is **A$199/month plus 10% GST**, with **30 reports** and **100 calculator estimates** included, then **A$5/report** and **A$1/calculator estimate**, plus GST. There is no setup fee.

## Embedded calculator pricing decision — 14 October 2026

The embedded STR calculator allowance is **100 completed estimates per account per month**, then **US$0.50 per additional completed estimate**. This supersedes the earlier calculator overage proposal for this feature. Retries and failed estimates must not count twice or incur charges. Preview estimates do not count.

Charging remains disabled for the current feature rollout. No Stripe price, subscription, currency, or live metering has been activated or changed. The existing catalogue below is historical AUD configuration; a future billing release must implement the USD decision explicitly rather than treating 50 USD cents as 50 AUD cents. The widget is implemented, but transactional usage-ledger integration and monthly allowance enforcement are still pending commercial activation.

## Stripe account and billing model

StayPack now has a separate Australian Stripe account and a sandbox. An organization is optional for consolidated management of multiple businesses; it is not the customer subscription or a prerequisite for billing. See [Stripe account guidance](https://docs.stripe.com/get-started/account/multiple-accounts).

The initial implementation uses Stripe Billing with three monthly subscription items:

| Item | Pricing |
| --- | --- |
| Agency subscription | A$199/month plus GST, quantity one |
| Completed calculator estimates | First 100 included, then A$1 each plus GST |
| Published reports | First 30 included, then A$5 each plus GST |

Usage prices use **graduated** tiers, with a zero-price included tier. Send all qualifying usage to Stripe; do not subtract the allowance before sending it, or it will be subtracted twice. Allowances reset on the subscription anniversary, not the calendar month. All amounts are integer AUD cents.

Stripe now recommends Metronome for new usage integrations. This implementation deliberately uses the simpler supported Billing Meters model for direct Checkout, the customer portal, and two straightforward allowances. The Supabase usage ledger keeps a future migration possible. Reassess Metronome before adding prepaid credits, enterprise commitments or complex pricing. See [Stripe's comparison](https://docs.stripe.com/billing/subscriptions/usage-based/compare-metronome).

## What counts

- A report counts on its first successful publication, whether through the legacy report route or a digital proposal. Later versions, retries, downloads and edits do not add charges. Duplicating an appraisal and publishing the duplicate counts as another report.
- A standalone calculator result counts once after successful completion and persistence. Its durable result ID is the deduplication key. Failed requests do not count.
- The estimate step within a report does not also consume standalone calculator allowance.
- Detached prospect examples are outside customer billing. Existing agencies are not enrolled or back-billed by the migration.
- Active enrolled subscriptions accrue usage. Trialing and unpaid states do not accrue charges in this version. Access enforcement for unpaid accounts is a separate launch requirement; billing does not currently lock users out of the existing workspace.

The standalone calculator widget is implemented; its billing integration remains disabled and pending. `recordCompletedCalculator(agencyId, resultId)` is the prepared server integration point. When implementing the widget, persist its result and billing event in the same database transaction, add abuse controls, and decide customer-facing overage limits before launch. A public client must never write arbitrary usage.

## Implemented components

- `/settings/billing`: admin billing page, usage and allowance display, estimated overage, Checkout and portal links. The default disabled state says pricing will be shown before subscription.
- `/api/billing/checkout`: agency owner/admin authorization, origin check, server-owned price catalogue, price/meter verification, and shared idempotent checkout attempt.
- `/api/billing/portal`: hosted payment details, invoice history and cancellation at period end. Self-service plan/quantity changes are disabled to avoid allowance and proration mistakes.
- `/api/billing/webhook`: verifies the raw request signature. Serializes retrieval of current subscription state so delayed webhook snapshots do not overwrite newer status. Stores processed event IDs and returns retryable failures.
- `/api/billing/usage-sync`: secret-protected outbox delivery. Netlify's scheduled function invokes it every minute after deployment.
- `billing_accounts`: agency/customer/subscription mapping and frozen price/allowance configuration, separated by test/live mode.
- `billing_usage_events`: durable, uniquely keyed events with customer, subscription, meter name, original timestamp, delivery state and retry lease.
- `billing_webhook_events`: processed Stripe event IDs, without storing full customer webhook payloads.

The publication trigger writes usage in the same transaction as publication. Billing tables have RLS. Owners/admins can read their agency's billing records; browser roles cannot change subscriptions, prices, or usage. The trigger's privileged function lives in a private schema with direct access revoked. Test and live metering cannot both be enabled for the same agency.

## Sandbox verification

The sandbox retains **old sample prices for integration testing only**: A$100/month, 100 calculator estimates included then A$1 each, and 10 reports included then A$5 each. These are not proposed commercial prices. All three prices are tax-exclusive; tax calculation is off for the test fixture.

The real Stripe API accepted a hosted Checkout session and customer portal session. A test subscription collected its A$100 base invoice. Sending 105 calculator estimates and 12 reports produced an upcoming A$115 invoice: A$100 base + A$5 calculator overage + A$10 report overage. Sending each usage request twice with the same idempotency key did not double the bill. Evidence is saved locally in `.codex/billing-sandbox-verification.json`.

```sh
docker compose exec app node scripts/setup-billing-sandbox.mjs
docker compose exec app node scripts/verify-billing-sandbox.mjs
docker compose exec app node scripts/verify-billing-sandbox.mjs --check
docker compose exec app npm test -- lib/billing app/api/billing
docker compose exec app npx tsc --noEmit --incremental false
```

These older fixture scripts require `sandbox-verification-v1`. Running the old setup script replaces the locally offered plan with that sample fixture; restore the commercial sandbox plan afterward using `setup-billing-agency-plan.mjs`. All setup and verification scripts reject live keys. The setup script writes the sandbox catalogue and portal ID into ignored `.env.local` and leaves billing disabled. Hosted Checkout does not need a publishable key in browser code.

Run `--check` after Stripe has aggregated the events; it checks the latest test subscription without creating another one and exits unsuccessfully while the invoice differs from the expected amount.

The app-to-database-to-Stripe integration also passed on 14 October 2026 using temporary agencies and actual signed webhooks forwarded by Stripe CLI v1.53.1. It verified authenticated billing-page rendering, idempotent Checkout creation, agency/member isolation, rejection of client-written usage and invalid signatures, webhook activation/deduplication, both report publication triggers, 117 unique usage events, the A$115 invoice preview, portal creation, and cancellation stopping metering. Temporary Supabase users/agencies and the associated Stripe test customer were removed. Evidence is in `.codex/billing-app-verification.json`.

To repeat this integration check, configure local test mode and run the official Stripe CLI with the sandbox key in `STRIPE_API_KEY`, forwarding the events listed below to `http://localhost:3000/api/billing/webhook`. Save its signing secret in ignored `.env.local`, configure `BILLING_CRON_SECRET`, restart the app, then run:

```sh
docker compose exec -e BILLING_APP_INTEGRATION=1 app node scripts/verify-billing-app.mjs
```

This script creates only temporary test fixtures and cleans them up. It checks Checkout creation and subscription activation; it does not automate entering payment details into hosted Checkout. Scheduled renewal/payment-failure recovery and deployed webhook/scheduler operation still need verification before commercial activation. Local billing is returned to `disabled` after setup.

## Agreed agency catalogue and GST

`agency-monthly-v1` was created and verified in the sandbox on 14 October 2026, then copied to the live StayPack account using Stripe's product-copy action. The live product has three monthly prices and no subscribers. The local app remains in `BILLING_MODE=disabled`; creating a catalogue does not activate customer billing.

- Live account: `acct_1UQJkNLsfKwd58Hq`
- Live product: [`staypack_agency_monthly_v1`](https://dashboard.stripe.com/acct_1UQJkNLsfKwd58Hq/products/staypack_agency_monthly_v1)
- Base: `price_1UQKoNLsfKwd58HqWDGrkHiE`
- Calculator: `price_1UQKoNLsfKwd58Hq1VCThs9t`
- Reports: `price_1UQKoNLsfKwd58HqeqgaTH7m`
- Live Australian GST: `txr_1UQKtPLsfKwd58HqKQiA21tN` (10%, exclusive, active)
- Live catalogue and complete plan configuration: `.codex/billing-agency-live-catalogue.json`. Use its `plan` object in `BILLING_PLANS_JSON` at deployment; the sandbox and live resource IDs differ.

The plan's `gstTaxRateId` applies a fixed, exclusive Australian 10% GST rate to the subscription, including metered renewals, using `subscription_data.default_tax_rates`. All three prices must remain tax-exclusive. `STRIPE_AUTOMATIC_TAX` must be false for this fixed-GST plan; the app rejects combining both tax systems. This is the Australian agency configuration. Do not use it for international tax treatment without reviewing that separately. See [Stripe fixed recurring tax rates](https://docs.stripe.com/payments/checkout/use-manual-tax-rates#fixed-tax-rates).

Real Stripe sandbox checks verified the hosted Checkout total and paid base invoice of **A$218.90**. Usage of 35 reports and 105 calculator estimates produced **A$251.90**: A$199 base + A$25 report overage + A$5 calculator overage + A$22.90 GST. Duplicate meter requests did not increase the bill. The temporary customer and subscription were cleaned up. Evidence: `.codex/billing-agency-verification.json`; sandbox catalogue: `.codex/billing-agency-catalogue.json`.

```sh
docker compose exec app node scripts/setup-billing-agency-plan.mjs
docker compose exec -e BILLING_SANDBOX_INTEGRATION=1 app npm test -- lib/billing/stripe.integration.test.ts
docker compose exec app node scripts/verify-billing-agency-plan.mjs
```

## Database installation

The migration is `supabase/migrations/20261014051147_agency_billing.sql`. It was applied to StayPack project `qmtfugaeujeikyegoxwi` on 14 October 2026 after verifying the digital-proposal dependencies. The filename matches the recorded remote migration version. It was first verified in disposable PostgreSQL 17 using `supabase/tests/billing_fixture.sql` and `billing_assertions.sql`. **Never run the fixture against Supabase.** It creates fake dependency tables and roles.

Use the repository's `supabase-staypacks` MCP connection in `.codex/config.toml`, explicitly scoped to StayPack. Its login and database access are verified. The separate ChatGPT Supabase app connector exposes a different project, `vacjqiurwcfhzxqkeiuk`. Do not replay the legacy migration history with an indiscriminate `db push`.

Post-installation checks verified RLS on all three billing tables, no anonymous table access, and service-only writes/RPC execution. Security and performance advisors found no new billing warnings. The informational notice for `billing_webhook_events` having RLS without policies is intentional: only the service role can access this internal table. Newly created indexes also show as unused until exercised. Existing warnings on legacy objects and Auth settings are outside this migration. See the [StayPack security advisor](https://supabase.com/dashboard/project/qmtfugaeujeikyegoxwi/advisors/security).

## Enable a dedicated test agency

1. The migration is installed in StayPack. Use a dedicated test agency because staging and production currently share Supabase.
2. Set `BILLING_MODE=test`, `BILLING_SITE_URL` to the exact app origin, the sandbox account/key, `BILLING_PLANS_JSON`, and the portal configuration ID. Restart the Docker service after changing its environment.
3. Set a random server-only `BILLING_CRON_SECRET`. Run the authenticated usage-sync endpoint manually for local/preview testing. Netlify schedules run automatically only on published deploys, not branch previews. [Netlify schedule behavior](https://docs.netlify.com/build/functions/scheduled-functions/)
4. Register an account-specific webhook destination at `/api/billing/webhook`, pinned to API version `2026-09-30.endive`. Store its signing secret as `STRIPE_WEBHOOK_SECRET`. For local development, use the Stripe CLI's webhook forwarding to localhost and its separate signing secret.
5. Subscribe to `checkout.session.completed`, `customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed`, `invoice.created`, `invoice.paid`, and `invoice.payment_failed`.
6. Complete Checkout for the test agency. A verified active subscription enables metering; existing agencies remain unchanged. Confirm duplicate Checkout submissions reuse a session, another agency cannot open its portal, and canceled/payment-failed states synchronize.
7. Publish test reports, confirm ledger events, dispatch them, and compare the local estimate with Stripe's invoice preview. Exercise renewal, payment failure and end-of-period cancellation before live activation.

Stripe's onboarding enabled Managed Payments by default in this sandbox. Checkout explicitly sets `managed_payments.enabled=false` for the direct Stripe Billing design. The integration does not opt into merchant-of-record services. Automatic Tax is independently controlled by `STRIPE_AUTOMATIC_TAX`.

## Usage delivery and reconciliation

Stripe processes meter events asynchronously. An `accepted` event means the API accepted the request, not that an invoice is finalized. Use the original ledger UUID as both meter identifier and request idempotency key on every retry. The dispatcher quarantines uncertain sends before the 24-hour deduplication window expires and stale events before the 35-day acceptance window; reconcile those records in Stripe before any resend. See [Stripe usage recording](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api).

Configure an invoice finalization grace period and alert on pending/needs-review usage, webhook failures and Stripe meter validation errors. The `invoice.created` handler returns an error when a renewal has unsent usage from the closing period, delaying automatic finalization. This is a bounded backstop, not an indefinite hold: operational intervention is required before Stripe's delay expires. Reconcile accepted events against Stripe meter summaries and finalized invoice lines before charging a correction. Never resend old events or mutate a finalized invoice blindly.

The initial dispatcher claims 25 events per invocation and has a time budget. Increase capacity based on queue age and rate limits, without running concurrent requests for the same customer/meter unnecessarily. Set up monitoring before enabling production overages. Automatic ingestion-error reconciliation and alerts are not implemented yet.

## Commercial launch decisions

Pricing, allowances, no setup fee and GST-exclusive display are agreed and configured. Trial policy and customer overage consent/spending limits remain launch decisions. No GST registration or legal business details were invented during setup.

The initial immutable **live** prices have been created. Future pricing changes require new prices and a new versioned plan ID. Keep existing plan snapshots and old catalogue entries while they have subscribers. In-place plan edits and mid-cycle self-service upgrades are not supported. Existing customers require an explicit agreed migration; the implementation preserves historical usage and published reports.

The user completed Stripe account activation. To launch, deploy the billing code, register the live webhook, configure monitoring and access enforcement, configure the live API key and the recorded live plan/GST IDs, verify them through the API, and only then set `BILLING_MODE=live`. The database migration is already installed. The billing foundation is committed for deployment with `BILLING_MODE=disabled`. No live subscription or customer charge has been created. Regional pricing and the US$0.50 calculator overage are not activated.

To pause billing operations, disable Checkout/dispatch with `BILLING_MODE=disabled` **and** disable the affected accounts' `metering_enabled` flags. The database trigger is independent of application environment variables. Preserve existing ledger entries for reconciliation.
