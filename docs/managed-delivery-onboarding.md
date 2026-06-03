# Managed delivery onboarding

Multi-tenant pipeline: **partner scrape → property ledger → STR PDF → email** (no product UI).

## Prerequisites

1. Apply migrations `027_delivery_platform.sql` and `028_delivery_tenant_brand.sql`.
2. Set environment variables (see `.env.example`):
   - `DELIVERY_CRON_SECRET` — protects cron and admin delivery APIs
   - `RESEND_API_KEY` + `DELIVERY_FROM_EMAIL` — production email (dev logs only without Resend)
   - Optional: `DELIVERY_ALERT_WEBHOOK_URL` — Slack/generic webhook on run failures
3. **Branding:** either `brand` in tenant JSON (no app account) **or** optional `agency_id` if they also use StayPacks.

## Create a tenant

```bash
curl -X POST "$SITE_URL/api/delivery/tenants" \
  -H "Authorization: Bearer $DELIVERY_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d @lib/delivery/tenants/config/pilot.example.json
```

### Config fields

| Field | Description |
|-------|-------------|
| `slug` | Unique tenant id (URL-safe) |
| `brand` | **Primary for white-label clients** — logos, colours, fonts, copy, agent card (see below) |
| `agency_id` | Optional — link existing StayPacks agency; `brand` overrides agency fields on PDFs |
| `scrape_schedule` | `{ "type": "interval", "intervalHours": 24 }` or `{ "type": "cron", "cron": "0 7 * * *" }` (daily, tenant timezone) |
| `timezone` | IANA zone, e.g. `Australia/Sydney` |
| `partner_sources` | `[{ "url": "...", "label": "...", "adapter": "...", "config": { "max_listings": 5, "maxPages": 2 } }]` — `max_listings` caps URLs per website per run (default 5); see `havenly.json` |
| `email_recipients` | Client inboxes |
| `deliverables` | `str`, `lease_appraisal`, or both |
| `billing_mode` | `dry_run` → reports, no email; `shadow` → digest logged; `production` → digest emailed |
| `partner_sources[].config.max_listings` | Max listing URLs taken from that index per run (default 5 per site) |
| `feature_flags.max_listings_per_run` | Cap listings processed per cron tick after per-site discovery (default 1 when STR + lease) |
| `str_template_pack_id` | Layout preset: `default`, `minimalist`, `classic_detailed`, `haven_properties`, etc. |

### Brand & templates (no app UI)

**Recommended:** bespoke template per client (e.g. Haven Properties).

- Code: `lib/reports/templates/haven-properties/` + logos in `public/delivery/haven-properties/`
- Hardcoded colours/logos in `brand.ts` — **does not** use agency Settings UI
- Tenant config: `str_template_pack_id: "haven_properties"`
- Preview: `/dev/haven-properties?listingId={uuid}`

**Optional:** tenant `brand` JSON still exists for overrides when using generic templates; bespoke templates ignore it.

Legacy JSON brand kit (generic templates only) — `lib/delivery/tenants/config/brand.example.json`:

| `brand` field | Controls |
|---------------|----------|
| `displayName` | Name on STR PDF |
| `logo_dark_url` / `logo_light_url` | Logos for light/dark report backgrounds |
| `primary_colour`, `accent_colour`, `background_colour`, `text_colour`, … | Report colours (same as Settings → Brand) |
| `heading_font_family`, `body_font_family` | Font preset ids (`fraunces`, `inter`, `montserrat`, …) |
| `report_template_id` | STR layout id (`minimalist-detailed`, `classic-detailed`, …) — overrides `str_template_pack_id` when set |
| `default_report_title`, `default_cta`, `default_disclaimer` | Copy blocks |
| `brand_advanced_json` | Advanced styles (same shape as agency advanced brand) |
| `agent` | Default agent name/photo/contact on automated reports |

On first run, the platform creates a **shadow agency** (`md-{slug}`) in the database for listings/reports FKs — **no users are invited**.

If a client later gets a real StayPacks account, set `agency_id` and keep `brand` to override specific fields on delivery PDFs only.

## Property ledger (dedupe)

Each listing is tracked in Supabase **`delivery_tenant_properties`** (per tenant):

| Column | Purpose |
|--------|---------|
| `source_site` + `source_listing_id` | Stable key from partner URL (e.g. SPFN slug) |
| `status` | `discovered` → `processing` → `delivered` or `failed` |
| `content_fingerprint` | Hash of title, address, beds, price, description snippet |
| `report_id` / `listing_id` | Links to StayPacks report + listing rows |
| `delivered_at` | When STR + PDF completed |

**Skip rules** (`lib/delivery/property-ledger/gate.ts`):

- Already **`delivered`** with the **same fingerprint** → skip (`already_delivered_unchanged`) — **no second Airbtics charge**
- Content changed but `reprocess_on_material_change: false` → skip (default for Haven E2E)
- Failed → retry up to 3 times

Cron / manual run processes every discovered URL but **only pays for new or retry listings**.

Inspect ledger:

```sql
select source_listing_id, status, delivered_at, report_id, listing_url
from delivery_tenant_properties
where tenant_id = (select id from delivery_tenants where slug = 'havenly-e2e');
```

## E2E test (Haven + SPFN)

```bash
# Next undelivered listing on SPFN page 1 (skips Labrador if already delivered)
npx tsx scripts/run-haven-delivery-e2e.mjs --pdf-only

# Re-run the same listing (clears ledger row — new Airbtics charge)
npx tsx scripts/run-haven-delivery-e2e.mjs --force --pdf-only

# Full run with email (requires RESEND_API_KEY + verified DELIVERY_FROM_EMAIL)
DELIVERY_TEST_EMAIL=you@example.com npx tsx scripts/run-haven-delivery-e2e.mjs
# or
npx tsx scripts/run-haven-delivery-e2e.mjs you@example.com
```

Output PDF is saved under `tmp/haven-e2e-*.pdf` and uploaded to Supabase `report-pdfs`.

### Re-print PDF only (no new Airbtics charge)

After template/PDF fixes, re-render from the existing published report:

```bash
# Dev server running on :3000; report lives in your Supabase project
PRINT_BASE_URL=http://localhost:3000 npx tsx scripts/regenerate-report-pdf.mjs --tenant havenly-e2e
```

Or pass the report UUID from the E2E log (`Report id: …`).

Writes `tmp/havenly-property-str-report-{address-slug}.pdf` (human-friendly name) and updates `pdf_url` in Supabase. Does **not** scrape, call REA, or fetch a new estimate.

Email attachments use the same naming pattern via `lib/delivery/reports/pdfFilename.ts`.

## Email (Resend — not SMTP)

Outbound delivery uses the **Resend HTTP API** ([`lib/delivery/email/client.ts`](../lib/delivery/email/client.ts)), not SMTP.

1. Create an API key at [resend.com](https://resend.com).
2. Add to `.env.local` / production env:
   - `RESEND_API_KEY=re_...`
   - `DELIVERY_FROM_EMAIL=havenly property <reports@yourdomain.com>` (verify domain in Resend first; use `onboarding@resend.dev` for testing)
3. **Digest email:** each cron/run sends **one email per run** with links to view/download STR and lease PDFs (no attachments). Implemented in [`lib/delivery/email/sendDeliveryDigestEmail.ts`](../lib/delivery/email/sendDeliveryDigestEmail.ts).

Without `RESEND_API_KEY`, dev mode logs the digest preview to the console.

## Rollout phases

1. **Dry-run** — `billing_mode: "dry_run"`: reports generated, ledger updated, no email.
2. **Shadow** — `billing_mode: "shadow"`: full STR + lease, digest logged (not sent).
3. **Production** — `billing_mode: "production"`: digest emailed to `email_recipients` + billable `delivery.sent` events.

### Havenly tenant

Config: [`lib/delivery/tenants/config/havenly.json`](../lib/delivery/tenants/config/havenly.json)

```bash
curl -X POST "$SITE_URL/api/delivery/tenants" \
  -H "Authorization: Bearer $DELIVERY_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d @lib/delivery/tenants/config/havenly.json
```

| Field | Notes |
|-------|--------|
| `deliverables` | `["str", "lease_appraisal"]` — both reports per listing, one shared listing row |
| `feature_flags.max_listings_per_run` | Default `1` when both deliverables (5 min route limit) |
| `feature_flags.rent_appraisal.tier` | `auto` \| `standard` \| `premium` |
| `scrape_schedule` | `{ "type": "cron", "cron": "0 7 * * *" }` — daily 7:00 tenant timezone |

Trigger a single tenant (ignores schedule):

```bash
curl -X POST "$SITE_URL/api/delivery/tenants/havenly/run" \
  -H "Authorization: Bearer $DELIVERY_CRON_SECRET"
```

Response includes `processedListings` with `publicUrl` / `pdfUrl` per report.

## Scheduler

Call every 15 minutes (only due tenants run):

```bash
curl "$SITE_URL/api/delivery/cron" \
  -H "Authorization: Bearer $DELIVERY_CRON_SECRET"
```

**Netlify:** scheduled function is enabled in [`netlify.toml`](../netlify.toml) (`*/15 * * * *` → `/api/delivery/cron`).

Set on Netlify: `DELIVERY_CRON_SECRET`, `RESEND_API_KEY`, `DELIVERY_FROM_EMAIL`, plus Bright Data / Supabase / Browserless / Airbtics / OpenAI keys.

**External cron** (cron-job.org, GitHub Actions) works the same if not on Netlify.

## Partner discovery adapters

| Adapter | Site | Method (probed) |
|---------|------|-----------------|
| `generic_links` | Most index pages | Static HTML + outbound listing link patterns |
| `spfn_first_national_v1` | `surfersparadisefn.com.au` | **Static fetch** on search pages → `/buy-residential-real-estate/{slug}` detail URLs |

Haven / First National Surfers Paradise example tenant: `lib/delivery/tenants/config/haven-spfn.example.json`.

Probe scripts:

```bash
npx tsx scripts/probe-spfn-discovery.mjs
npx tsx scripts/test-spfn-pipeline.mjs
```

Listing addresses are parsed from URL slugs + detail pages, then enriched via the delivery extract waterfall (`extractListingForDelivery`: agency site → REA → Domain).

## Property ledger

- Key: `tenantId` + `sourceSite` + `sourceListingId`
- Already **delivered** with unchanged fingerprint → skipped (no STR, no email, no billing)
- Failed listings retry up to 3 times

## Usage / billing export

```bash
node scripts/export-tenant-usage.mjs pilot-client 2026-06
```

Or API:

```bash
curl "$SITE_URL/api/delivery/usage/pilot-client?period=2026-06" \
  -H "Authorization: Bearer $DELIVERY_CRON_SECRET"
```

## Phase 2 (implemented)

Lease appraisal plugs into the same orchestrator via `deliverables: ["str", "lease_appraisal"]`. Both reports share one listing row; ledger stores `delivery_reports` JSON with STR + lease links.
