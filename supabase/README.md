# Supabase setup

Run these steps after creating your Supabase project.

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run every file in `migrations/` in numeric order (`001` through `018`, etc.).
   - If social posts or rental brochure fail with `collateral_items_type_check`, run [`migrations/018_collateral_types_rental_social.sql`](migrations/018_collateral_types_rental_social.sql).
3. Enable the Email auth provider in Authentication → Providers.
4. Copy project URL, anon key, and service role key into `.env.local`.
5. Set local URLs:
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
   - `NEXT_PUBLIC_REPORTS_URL=http://localhost:3000`
   - `QR_CODE_BASE_URL=http://localhost:3000`

Optional later (step numbers above assume full migration run):

- Add `OPENAI_API_KEY`
- Add `AIRROI_API_KEY` for new STR estimates. Existing Airbtics reports remain readable.
- Add `BROWSERLESS_API_KEY` and `BROWSERLESS_BASE_URL`
- Add `GOOGLE_MAPS_API_KEY`

New STR estimates require `AIRROI_API_KEY` in the server environment. Without copy/PDF keys, development mode returns mock copy/PDF data. The development regression preview supplies synthetic estimates for UI testing.

## Migration history

The original numbered migrations were installed through the SQL editor. Do not
blindly replay them on the existing production database with `db push`; its CLI
history is not a baseline of those older installations.

The 9 October 2026 agent directory and separate property price migrations are
already applied and recorded in production. Their filenames match the recorded
versions. Deploying the application does not run migrations automatically.

The 10 October 2026 AirROI compatibility migration
[`20261010080940_allow_airroi_estimates_without_airbtics_tier.sql`](migrations/20261010080940_allow_airroi_estimates_without_airbtics_tier.sql)
is applied and recorded in production. It makes `reports.airbtics_tier` nullable
and removes its legacy default, preserving historical values and the summary/full
check. The production schema was verified with an AirROI metadata update on a
temporary copy of a report, rolled back without changing live report data or
calling the estimate provider.

[`20261010083434_add_company_str_management_presets.sql`](migrations/20261010083434_add_company_str_management_presets.sql)
is also applied and recorded in production. It adds the company preset JSON array
to `agencies`; existing agencies start with no presets. A save was verified on a
temporary table in a rolled-back transaction, with agency RLS confirmed enabled.
The application writes presets through the existing agency-admin access check
and scopes updates to that admin's agency. No existing report is modified.

## Short-Term Rentals workspace

[`20261010232632_str_appraisal_workspace.sql`](migrations/20261010232632_str_appraisal_workspace.sql)
is applied to the existing StayPack project, which is shared by production and
the staging preview. This is additive: 150 positively identified STR reports were
registered without rewriting their final report JSON, PDF URLs or public links.
Compatibility triggers register STR reports created by the previous app version
while the new workspace is evaluated on staging.

[`20261010233726_str_recipient_conflict_http_status.sql`](migrations/20261010233726_str_recipient_conflict_http_status.sql)
is applied immediately after it. Expected stale edits use `PT409` so PostgREST
returns HTTP 409 instead of retrying an engine serialization error. See
[Supabase's RPC conflict guidance](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

`str_appraisals` adds customer-specific metadata to the existing report. Private
recipient snapshots and reusable `agency_contacts` are protected by agency RLS
and are never merged into public report JSON. Creation and recipient edits use
security-invoker RPCs, with atomic creation, retry-safe request IDs and stale-edit
checks. Existing agencies retain access through the central STR access helper;
subscription gating can be added there later.

The review environment is
[Short-Term Rentals staging](https://str-workspace--staypack.netlify.app/short-term-rentals).
Netlify's `str-workspace` branch context and deploy-preview build context use the
staging site/report URLs with the existing Supabase credentials. Build the preview
with `netlify deploy --context deploy-preview --alias str-workspace`; do not add
`--prod`. Production remains a separate app deploy. Next.js middleware bundling
requires the pinned `@opentelemetry/api` dependency in `package.json`.

The STR editor follows Property & customer → Estimate & evidence → Design &
content → Review & share. Layout selection uses saved estimates; switching layouts
preserves the evidence, wording and photos. Property changes that affect an
estimate return the user to evidence review. No database migration is needed for
this step order. LTR, sales and brochure wizard ordering is unchanged.

Properties and import stay shared. Multiple appraisals can use the same listing;
the existing property-level STR collateral pointer stays stable for brochures.
Archiving an appraisal disables its public report page without deleting the
property or PDFs already downloaded. Restoring does not republish it.

The calculator widget, engagement analytics, messaging and billing remain future
work. This change captures contact details but does not send email or SMS.

Validation:

- `tests/str_workspace_fixture.sql` and `tests/str_workspace_assertions.sql` run
  only in an **empty disposable PostgreSQL 17 database**: fixture, both STR migrations, then
  assertions with `psql -v ON_ERROR_STOP=1`. Never run the fixture on Supabase.
- Unit coverage is in `lib/str-appraisals` and existing report/delivery suites.
- `components/reports/StrJourney.test.tsx` covers ordering, save failures,
  backtracking, template switching and saved-report compatibility.
- `tests/staging/str-step-order.spec.ts` runs the complete desktop/mobile journey
  against `/dev/lint-regression` with synthetic provider responses.
- `tests/staging/str-workspace.spec.ts` is opt-in live browser coverage. Set
  `STR_LIVE_TEST=1`, `STAGING_BASE_URL` and Supabase environment credentials. It
  creates a temporary agency/account, exercises the real API, and removes its
  records. No messages or paid estimate/PDF generation are triggered.
- Supabase advisors report no findings on the added objects. Existing findings
  remain on legacy functions and Auth settings; see the
  [database security advisor](https://supabase.com/dashboard/project/qmtfugaeujeikyegoxwi/advisors/security).

## Digital STR proposal workflow

The main editor at `/short-term-rentals/appraisals/[reportId]` now follows
**Property → Rental appraisal → Proposal → Customer & share**. The old
`/proposal` editor URL redirects there. Legacy non-workspace report flows are
unchanged. The development template studio remains at
`/dev/str-proposal?reportId=...`; it is not the customer authoring interface.

Apply these migrations after the STR workspace migrations, in order:

- `20261012000950_digital_proposal_workspace.sql`
- `20261012002612_digital_proposal_draft_index.sql`
- `20261012020830_digital_proposal_integration.sql`
- `20261012021839_proposal_activity_version_details.sql`

### Account designs and publication

`digital_proposal_assignments` holds one onboarding-owned design per agency and appraisal kind:
`agency_id`, `kind` (`str`, `lease`, or `sales`), `name`, positive integer `version`, and `defaults` (validated by
`proposalDraftSchema`). Provision/update assignments using a trusted server or
admin migration and increment `version` when changing the design. Members can
read the assignment but cannot write it. Without a row, the base template uses
the agency's current brand. New drafts inherit the assigned content/pages;
existing drafts keep their introduction, configured page selection/order, agents,
documents and links. Save and publish enforce the assignment's page definitions,
appraisal heading, renderer, preset, brand, hero and motion settings. Pages can
be added or have their copy changed during brand onboarding; users cannot create
or rewrite pages in an appraisal. Unconfigured text pages cannot be enabled.
The development studio can save experimental settings with
`?studio=1`; publication still uses the account assignment. Additional bespoke
renderers require a registered, versioned renderer in code.

Drafts use revision checks to reject stale saves. Publishing checks the current
property, appraisal, customer and assignment fingerprint. It stores data, brand,
enabled pages and selected documents in an immutable `final_report_json` snapshot.
Identical publication requests reuse the version. Separate
`digital_proposal_links` records allow revocation and a fresh link for the same
version without restoring an old link. Existing links remain on their original
version after edits. Customer email and phone stay private; the customer display
name is included. Up to two active account agents can be attached to a proposal;
their public name, role, photo, phone and email are frozen into the published
snapshot and displayed on Next steps and the PDF. Archived or cross-account agent
IDs are rejected. Agent choices do not change the listing's agents. Public pages
use no-index, no-referrer and no-store headers.

### Documents, agreement links and PDF

Documents are PDFs up to 4 MiB in the private `proposal-documents` bucket. Downloads
require agency access or an active share token whose snapshot includes that
attachment. Files are streamed through the server; no public storage URLs or
reusable signed URLs are exposed. Archiving a listing or appraisal revokes its
versions permanently. Previously downloaded copies cannot be recalled.

**Review & sign** opens the supplied HTTPS signing URL. A click is not a signature
or a completed agreement. Embedded signing, provider callbacks and automated
email/SMS delivery remain future integrations.

Publishing makes the digital link available first, then requests the PDF. A
failed PDF can be retried independently. Browserless renders the same immutable
snapshot through the trusted print renderer; PDFs live in private
`proposal-pdfs` storage and downloads check the active token each time. The
Next steps page exposes **Download proposal PDF** once it is ready. PDF generation
needs the configured Browserless server key; the digital proposal does not.

Havenly's `haven-properties-str` assignment uses its two-page branded PDF. New
publications freeze a separate, validated `pdfReport` in the existing JSON snapshot,
with the same saved appraisal inputs and explicitly selected proposal agents. The
signed `/proposal/print/[versionId]` route renders that version through the existing
Browserless report pipeline. It does not fetch current estimates or agent profiles.
Older publications without `pdfReport` retain their original digital print output;
republish to create a version with the branded PDF. No schema migration is required.

### Activity

Public links record an open, enabled page views, comparison-tab interactions,
visible comparables, document/PDF clicks, and action/agreement clicks. Private
previews and the template studio do not record events. Sessions use a random
per-link browser identifier with 30 minutes of inactivity expiry, not contact
details or fingerprinting. Repeated event targets count once per session;
known bots are excluded and inserts are rate bounded. These are link visits and
interactions, not verified customer identities or proof a document was read.
Forwarded links can contribute activity. Labels are resolved against the exact
published version viewed. The dashboard shows opens; Customer & share includes
the activity breakdown. Signing completion is not inferred from clicks.

### Validation

Run `lib/digital-proposals`, `components/digital-proposals`, and
`components/reports/StrJourney.test.tsx` with Vitest. The opt-in
`STR_LIVE_TEST=1 ... vitest run lib/digital-proposals/integration.live.test.ts`
uses disposable agencies, users, synthetic saved estimates and test files for
isolation, publication, versioning, activity and revocation checks. Add
`STR_PDF_TEST=1` only when intentionally testing real Browserless generation.
Add `STR_HAVEN_TEST=1` to exercise the branded PDF, print-token access and selected
agents using a disposable account with the Havenly template grant.
It removes its own database and storage records. The opt-in Playwright
`tests/staging/str-proposal-workspace.spec.ts` covers the development template
studio and stubs PDF generation. `str-digital-proposal.spec.ts` covers the renderer.
For SQL-only checks, use an empty disposable PostgreSQL 17 database and the
fixtures/assertions in `supabase/tests/`; never run those fixtures on the app DB.

### Published proposal performance

The public viewer uses one uncached inner-join lookup across links, versions,
reports and listings. It verifies matching agency ownership and active status on
every request. It bypasses dashboard session refresh; share tokens remain the
public access boundary. No schema migration is required.

A separate server-side Next Data Cache stores the immutable digital snapshot by
version and content hash for 24 hours. PDF source data is excluded from that
projection. The publication route warms it with `after()`; opening an existing
publication fills a cold cache automatically. The mutable access check and PDF
availability are never cached, and public HTML/download responses remain
`private, no-store`. Do not add `force-dynamic` to the viewer page: that would also
disable its explicitly cached data fetch. Its `no-store` access fetch already
makes the page dynamic. PDFs use only the fresh access lookup before downloading.

The browser paints the branded cover first and shows a preparation indicator for
at most three seconds. Page modules and images use separate queues (two jobs each)
so slow photography does not hold up JavaScript. Included pages render once in
inert, inaccessible offscreen frames at their actual width; charts finish rendering
before navigation reveals them. Fonts and primary images have bounded waits.
Navigation keeps the current page visible until its destination is ready, with
latest-request-wins behaviour and a reload/cancel fallback for failures. Prepared
pages stay mounted, preserving chart tabs and carousel position. Reduced-motion
users receive no reveal animation; data-saving connections prepare only the next
page automatically. Hidden frames never generate page/comparable views, and
preparation never fetches PDFs, attachments or agreement links.

Performance checks should compare cold-browser visits using production builds.
Dev compilation times are not representative. Verify direct section links,
mobile layout, browser history, real interaction tracking, fresh PDF availability,
and revocation/archive behaviour after warming the snapshot cache.

## Detached prospect brands

`20261013045131_detached_prospect_brands.sql` is applied to the shared StayPack database.
Its filename matches the recorded migration version. Prospect brand profiles and example
proposals have no required agency reference, login, membership or billing record. Only
explicitly enrolled internal operators can read their own rows. The private `/prospects`
library is not included in customer navigation. Customer membership alone grants no access.

`/example/[token]` renders the saved public projection; raw imports, provider payloads,
operator details and original selling agents remain private. Examples can be revoked.
Signup is separate: the service-only `attach_prospect_brand` operation atomically applies
branding and management defaults to an existing agency, installs its proposal design and
links the prospect record. It creates no account and leaves shared example snapshots intact.

See `lib/prospects/profiles/README.md` for creation and onboarding commands. The current
creation flow is operator-driven, and the internal library is read-only. This feature is
available on the `prospect-examples` draft deployment; production was not redeployed.

Verification: 21 focused tests and TypeScript/ESLint checks pass. The preview build passed.
Database RLS was exercised using both Cameron's operator identity and the existing Havenly
member identity (zero prospect rows visible to Havenly). Anonymous access and customer
writes/adoption are denied. Supabase security advisors report no findings on the added
objects; pre-existing advisor findings were unchanged.


## Shared rental and sales proposal workspace

`20261014062925_shared_appraisal_workspace.sql` was applied to production on 14 October 2026
so the local shared-appraisal branch can use the existing account and data. The
filename matches the recorded production migration version. All 247 existing
reports retained identical final JSON and status; STR design defaults and versions
also retained identical checksums. The application release uses this existing
migration without reapplying it.

The sidebar exposes all appraisals, short-term rentals, rental appraisals and sales
appraisals. Rental and sales follow Property → Review evidence → Proposal →
Customer & share. The listing library supplies the starting property. Customer
proposals have separate working inputs: changing their photos, description,
figures or comparables does not edit the shared listing or other customers' work.
The existing STR editor, branded renderers, example links and version-1 projection
remain in place. Rental and sales use a typed version-2 projection in the same
publication, attachment, agent-selection, analytics and revocation infrastructure.

The physical `str_appraisals` table is retained for compatibility with existing
report/recipient RPCs and deployed writers. Its `kind`, `inputs_json`,
`input_revision`, `document_json` and `document_revision` columns serve the new
products. `appraisals` is a security-invoker view over that table, with authenticated
read access governed by the underlying agency RLS. Legacy rental/sales reports
are registered and snapshotted by the migration without changing their existing
report JSON. Registration triggers also cover the legacy generation routes.

`create_appraisal` is idempotent per request UUID and rejects reuse for a different
property, kind or recipient. Saves compare the expected timestamp. Enrichment
jobs carry the appraisal ID and source timestamp; workers save only into that
appraisal and fail on conflicting edits. Property changes invalidate evidence via
the existing subject fingerprint. Publishing requires a prepared document at the
current input revision. Existing links can still be viewed/revoked while new
evidence awaits review. PDFs render only the frozen published document through
Browserless, using the existing rental/sales print templates.

Brochure routes, editors and renderers are unchanged. The first appraisal remains
the property's source pointer; subsequent customer appraisals never replace it.
The first prepared document initializes a missing source report once. Later
proposal changes update the separate working document and cannot rewrite an
existing brochure source or historical publication.

Release validation:

- `npm run build` includes navigation regression tests and verifies all 60
  required creation, appraisal, proposal and marketing routes. Missing routes fail the deploy build.
- `npm test`, `npm run lint`, and `npx tsc --noEmit` cover the shared code and the
  existing STR, appraisal and brochure modules.
- Against a disposable backend, opt in with `APPRAISAL_INTEGRATION_TEST=1` and
  `STAGING_BASE_URL` to run `lib/appraisals/workspace.live.test.ts` and
  `tests/staging/appraisal-workspace.spec.ts`. The integration suite seeds synthetic
  evidence and tests actual worker persistence with the provider boundary mocked.
  `APPRAISAL_PDF_TEST=1` additionally exercises the configured Browserless server,
  private storage and PDF download. Never point these fixture tests at production.
- Run `tests/staging/str-workspace.spec.ts` with `STR_LIVE_TEST=1` against the same
  disposable backend to verify the existing STR navigation and publishing journey.

Local migration verification replays the schema, skipping only old data-only
migrations `037`, `040`, `041` that reference production agency UUIDs. Legacy
three-digit migration names contain duplicate versions; local copies receive
unique test-only version numbers. Repository and production history stay unchanged. Migration verification also seeds
legacy STR/rental/sales records before applying the new migration and checks that
their JSON, publication status and STR assignment survive unchanged.

Verification on 14 October 2026: 1,072 unit/component tests passed (two live suites
are opt-in); all three desktop/mobile STR, rental and sales browser journeys
passed against the compiled build. The rental/sales live API suite passed with
agency RLS, stale saves, background-worker conflicts, publication immutability,
revocation/archive, and real local Browserless PDF generation/download. Clean
schema replay, legacy backfill assertions and PostgreSQL schema lint passed.
TypeScript, the production build and both Netlify worker bundles passed. ESLint
reported zero errors and 53 existing warnings. External market evidence was
synthetic; no production records or provider configuration were changed.

### Agency property country

`agencies.country_code` is the account's ISO country code (`AU` or `US`), set during onboarding or in Settings → Agency details. Existing agencies default to `AU`. The existing agency membership and administrator RLS policies govern this field.

Property searches, imports, saved-property selection and appraisal provider calls enforce the account country on the server. Australian accounts use Domain profiles and Australian address suggestions; US accounts use Google Places restricted to the US and Zillow-backed property profiles/comparables. `RAPIDAPI_US_PROPERTY_KEY` is an optional dedicated US provider credential (otherwise the existing RapidAPI key is used).

Report/proposal snapshots store their own country, currency and rent period. US rentals display monthly USD; Australian rentals remain weekly AUD. Existing weekly database amounts remain weekly internally, with conversion at the input/display boundaries. Changing an account country does not rewrite properties, reports or published proposal versions. Add future countries deliberately to the database constraint, validation and provider routing together.


## Embeddable STR calculator

[`20261014104828_str_calculator_widget.sql`](migrations/20261014104828_str_calculator_widget.sql)
is applied to the connected StayPack database. It adds `str_calculator_widgets`
and `str_calculator_leads`; it does not enable calculators for existing agencies.
The application changes still need a deployment before production embeds work.

**Marketing → STR calculator** (`/marketing/str-calculator`) opens on **Leads**.
The **Embed & settings** tab (`?tab=setup`) contains the preview, activation,
market and optional phone settings, and iframe code. Both views are URL-backed;
switching views preserves the lead page and unsaved settings during navigation.
Agency admins select Australia or the United States and activate the calculator.
`/embed/str-calculator/[token]` is public and works without account
cookies. Pausing immediately blocks new submissions; the embed URL stays stable
when settings are saved. The preview uses a labelled sample and creates no leads.
The widget reads current agency colour and font settings on each load.

[`20261014113703_str_calculator_optional_phone.sql`](migrations/20261014113703_str_calculator_optional_phone.sql)
is applied to the connected database. Account admins can turn on **Ask for phone
number** and save settings without activating a paused calculator. It defaults
off; when enabled, **Your details** shows an optional phone field. Submitted phone
numbers appear beside email in the lead list, under the existing agency-member
RLS policy. They are never sent to AirROI or returned in the public estimate.
The reservation RPC strips phone data when the setting is off, including if it
changes while a visitor is completing the form. Existing leads remain unchanged.

Live submissions collect an address, bedrooms, bathrooms, email and explicit contact consent.
The server saves the enquiry, geocodes a complete street address, then calls the
standard AirROI calculator once (no extra market occupancy request, scraping or
report generation). `GOOGLE_MAPS_API_KEY`, `AIRROI_API_KEY` and the Supabase service
role key are required. The selected bathroom count supports half baths and is saved
in `input_json` and used in the estimate. Guests default to `min(10, max(2, bedrooms * 2))`,
and the search radius is 2 km; these assumptions are visible
with the estimate. Original input, raw provider response and displayed estimate
are stored separately. Failed estimates retain the enquiry for agency follow-up.

Agency members can read only their own lead projection. Raw provider data and
request fingerprints are service-only. Anonymous clients cannot read either
table or execute the reservation RPC. The RPC uses a row lock, request IDs and
keyed hashes to prevent duplicate paid calls and enforce limits across instances:
100 enquiries per calculator per rolling 24 hours and 5 per client IP per hour.
Only Netlify's trusted connection-IP header is used in production; other runtimes
share an `unknown`/local bucket rather than trusting spoofable forwarded headers.

Verification: `supabase/tests/str_calculator.sql` runs rollback-only database
checks. `docker compose exec app node scripts/verify-str-calculator.mjs` creates
and removes disposable agencies/users to verify settings, lead isolation, public
rendering, replay, and pause behaviour without paid calls or email delivery.
The development-only `/dev/str-calculator` includes sample data; `?view=mobile`
tests a 320 px iframe. Production builds return 404 for this development page.

### Pricing held for later activation

The agreed allowance is 100 completed estimates per account per month, then US$0.50
per additional completed estimate. Charging and monthly billing enforcement are
not enabled in this rollout. Preview results are free and create no usage.
The existing AUD billing catalogue is not changed by this feature deployment.

Production rollout on 14 October 2026: Netlify deploy
`6acf72aaa7c66b4d87780f52`, based on production commit
`63396095f593f8b6f1e892149f4dec141122208a`. The existing production navigation is
preserved, with STR calculator added under Marketing. The live account was
verified on both Leads and Embed & settings; its calculator remains inactive.
The calculator release source is preserved in Git with regression checks for the
existing production navigation and required routes.

For manual Netlify releases, use `netlify deploy --build --context production`
to build and upload the adapter output together, verify the draft's styling and
assets, then promote that exact deploy. A standalone `netlify build` followed by
`netlify deploy --no-build` using `.next` uploads the restored raw Next.js build,
not the adapter's prepared public assets.

## Agency billing

[`20261014051147_agency_billing.sql`](migrations/20261014051147_agency_billing.sql)
is applied and recorded in StayPack project `qmtfugaeujeikyegoxwi`. It adds agency
subscriptions, an idempotent usage ledger, webhook processing records, and report
publication triggers. Existing agencies are not enrolled or back-billed.

RLS and service-only writes were verified remotely. A temporary agency completed
the local app/Supabase/Stripe sandbox integration check, including usage overages
and cancellation; its test records were removed afterward. Commercial billing
remains disabled. See [billing setup and launch requirements](../docs/billing-infrastructure.md).

## Shared calculator estimate cache

`20261015024019_airroi_calculator_cache.sql` adds a dedicated, service-only cache
and four security-invoker RPCs. It was applied and verified in production on
15 October 2026 before deploying the server adapter.
No existing report, lead, publication snapshot or billing record is changed.
There is no historical backfill or cleanup of original report/lead responses.

The server hashes the effective provider request and shares its raw successful
response between report generation and embedded calculators. Contact details,
branding, agency adjustments and selected comparables are not shared cache data.
Browser roles have neither table access nor RPC execution permission. Consumers
must retain their normal agency authorization and lead reservation checks.

`20261015051750_airroi_property_calculator_cache.sql`, applied on 15 October 2026,
adds property-aware matching for complete Australian and US addresses. Reports
and widgets hash the same normalized street/unit, locality, region, postcode and
country. Matching also requires identical beds, baths, guest capacity, radius
and currency, with coordinates no more than 50 metres from the original fetch.
Different units and neighboring addresses remain separate. Ambiguous/incomplete
addresses use the original exact-coordinate cache. No address or contact text is
stored in the shared cache: only hashes and effective numeric/provider inputs.

The service-only property claim RPC uses a short transaction lock for matching
coordinate variants, then retains the normal durable provider lease. Reuse never
moves the original coordinate anchor or extends expiry. The adapter preserves
the original effective inputs in `raw.input` and, when coordinates differ, records
the caller's values separately in `raw.requested_input`. Unassigned legacy rows
can be adopted only through their matching exact request key; another property's
identity is never overwritten. No historical report or lead is backfilled.

Each successful fetch is valid for exactly 720 hours (30 days), starting at the
database completion timestamp. Reads and completion retries never extend the
expiry. Expired data is never returned, including during provider failures.
Provider calls run outside database transactions. A 60-second per-key lease
coalesces concurrent callers across server instances; only its owner can save
the result, and a failed request enters a 30-second retry cooldown. A crashed
worker's expired lease can be replaced. Provider timeouts can still have an
unknown billable outcome; this is not a provider-level exactly-once guarantee.

The scheduled `airroi-calculator-cache-cleanup` Netlify function runs every five
minutes and deletes only expired dedicated-cache rows and abandoned work older
than a day. The claim RPC also clears an expired payload when it is requested
again. The scheduled function requires `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`; it remains independent of billing and makes no paid
provider calls. Cache expiry is immediate; physical row cleanup follows the next
successful scheduled run. Monitor function failures and cache backlog on rollout.

Per-key hit, fetch-attempt and failure counters support operational cost checks
while the row exists. They are not customer usage or billing events. Historical
reports continue to render their saved snapshots, regardless of cache expiry.

Validation uses an **empty disposable PostgreSQL 17 database**, never Supabase:

1. Run `tests/airroi_calculator_cache_fixture.sql`.
2. Run `migrations/20261015024019_airroi_calculator_cache.sql`.
3. Run `tests/airroi_calculator_cache_assertions.sql` with `psql -v ON_ERROR_STOP=1`.
4. For a Docker database, run
   `python3 supabase/tests/airroi_calculator_cache_concurrency.py CONTAINER`.
5. Apply `migrations/20261015051750_airroi_property_calculator_cache.sql`, run
   `tests/airroi_property_calculator_cache_assertions.sql` with `psql -v ON_ERROR_STOP=1`,
   then `python3 supabase/tests/airroi_property_calculator_cache_concurrency.py CONTAINER`.

Assertions cover fixed expiry, completion retries, stale owners, failures,
bounded cleanup, browser-role denial and unchanged report/lead/billing sentinels.
The concurrency test launches twelve independent database sessions and verifies
one fetch lease followed by twelve cache hits. Scheduled cleanup coverage lives
in `lib/airroi/calculatorCacheCleanup.test.ts`.
Property matching tests additionally cover the 50-metre boundary, separate units,
strict configurations, unchanged anchors, expiry, concurrent coordinate variants,
and competing properties adopting one legacy row. Adapter integration tests cover
report-to-widget and widget-to-report reuse, original input provenance and no
additional calculator request on a cache hit. Billing remains disabled.

## Calculator lead to report

`20261015024032_str_calculator_lead_reports.sql` adds the private lead's report
link and the service-only `create_str_calculator_lead_report` RPC. Both calculator
migrations were applied and verified in production on 15 October 2026 before the
application release. Existing report snapshots were verified unchanged, and no
accounts had metering enabled. Commercial billing stays disabled.

Create report creates a separate property draft and STR appraisal in one
transaction. Completed Australian and US addresses retain their unit/street,
suburb/city, state and postcode/ZIP for subsequent property lookup. The source
address remains unchanged on the lead; ambiguous address text is kept intact
instead of guessing missing fields. Conversion makes no extra address API call.
It copies a valid estimate only when the original provider fetch is
less than 720 hours old, retaining its exact timestamp, inputs and full baseline.
Agency management assumptions apply to the new final estimate only. For a new
draft with a reusable baseline, creation fetches the missing market occupancy
history through the existing market cache before saving the draft atomically.
It makes no calculator estimate request and preserves the baseline, comparable
pool, selected comparables and original fetch time. Unavailable market history
keeps the existing annual benchmark fallback. Expired, invalid or incompatible
historical inputs produce a draft needing an estimate, without a market request.
Legacy leads without provider timestamps use their original completion date.
Customer names and property photos can be completed in the normal editor.

`20261015024716_str_calculator_lead_report_listing_slug.sql`, also applied on
15 October 2026, supplies the required unique property slug when creating a new
draft. This reserves an internal identifier without publishing a property page.
The disposable database fixture enforces production’s non-null, no-default slug
requirement and uniqueness within each agency.

`20261015025920_str_calculator_lead_report_market_occupancy_cost.sql`, applied on
15 October 2026, preserves the newly fetched market occupancy cost in the draft
total while the reused calculator cost stays zero. This is provider cost metadata;
it does not create billing usage or enable metering. Market evidence retains its
own timestamp separately from the original calculator timestamp.

The transaction checks agency membership and lead ownership, locks the lead and
returns its linked report on retries without updating that report. The UI then
shows Open report. Existing properties, report JSON, publication versions, PDF
links and billing records are not backfilled or rewritten. The new HTTP endpoint
is included in the production route verification gate.

For disposable PostgreSQL 17 verification, run `tests/str_workspace_fixture.sql`,
then `tests/str_calculator_lead_reports_fixture.sql`, followed by migrations
`20261010232632_str_appraisal_workspace.sql`,
`20261010233726_str_recipient_conflict_http_status.sql`,
`20261014104828_str_calculator_widget.sql`,
`20261014113703_str_calculator_optional_phone.sql`, and
`20261015024032_str_calculator_lead_reports.sql`, and
`20261015024716_str_calculator_lead_report_listing_slug.sql`, and
`20261015025920_str_calculator_lead_report_market_occupancy_cost.sql`. Finally run
`tests/str_calculator_lead_reports.sql` with `psql -v ON_ERROR_STOP=1`.
These tests check cross-agency denial, original timestamp precision, exact expiry,
creation retries, retained occupancy evidence and costs, and byte-for-byte
preservation of existing report/property data. `lib/str-calculator/leadReportOccupancy.test.ts`
exercises the real market adapter with mocked HTTP: AU/US conversion, full
comparable retention, market cache reuse, unavailable data and existing-report
replays, with no calculator endpoint calls.

## Shared clients and calculator carry-through

`20261015234716_client_directory_and_calculator_carry_through.sql` adds the private
Clients directory API and lead-to-client association. It was applied and recorded
in StayPack on 16 October 2026, before deploying the client UI. Existing `agency_contacts` are reused; existing
reports, proposal snapshots, PDF links and legacy duplicate contacts are not
backfilled or rewritten. Billing is not changed or enabled by this migration.

The calculator reservation RPC keeps its existing signature and accepts a nullable
`full_name`, so already-open embeds can still submit. Report creation resolves a
client from the saved lead within the same transaction. A unique, consistent email
match can be reused; name/phone conflicts, ambiguous email matches and archived
contacts require account review. Public input never updates a matched directory
record. Legacy nameless leads retain their email/phone in private pending metadata.
New proposals cannot publish until the account supplies/selects a client or
explicitly chooses general use. An existing linked report is returned before any
client resolution, so retries never change its saved recipient.

Recipient snapshots remain independent of directory edits. All three appraisal
kinds share the same recipient RPC and agency-scoped search. Directory writes use
optimistic concurrency; advisory locks plus a table trigger prevent duplicate
active email records during simultaneous report/lead creation and direct writes.
Existing duplicate emails are left intact and must be resolved by explicit client
selection. Private client history returns the newest 50 linked reports and
calculator enquiries, with total counts.

The one security-definer function lives in the non-exposed `client_private`
schema. It checks the authenticated actor's agency membership (or service role)
and only updates the contact link on the source lead already linked to that same
report and agency. It cannot rewrite contact details, report data or estimates.
All client-facing RPCs remain security invoker under existing agency RLS.

Validation uses a new **empty disposable PostgreSQL 17 Docker container**, never a
Supabase project:

```sh
docker run --name staypack-clients-qa -e POSTGRES_PASSWORD=clients-disposable -d postgres:17-alpine
python3 supabase/tests/client_directory_run.py staypack-clients-qa
python3 supabase/tests/client_directory_concurrency.py staypack-clients-qa
```

The runner creates the fresh `client_directory_qa` database and fails if it already
exists. It applies the exact dependency migrations and verifies agency isolation,
name/phone capture, legacy review, duplicate/conflict handling, client history,
archive/edit behavior and unchanged report/publication snapshots. It also runs the
existing calculator-cache-to-report regression. Three concurrency cases each use
12 independent sessions: client resolution, direct inserts and Create report.
Remove only the disposable QA container when finished. Route and source-recipient
unit coverage is in `lib/clients/`.

The opt-in `CLIENT_SETUP_LIVE_TEST=1` Playwright test in
`tests/staging/client-setup.spec.ts` creates and removes a disposable account. It
checks actual calculator report conversion and retries, client search and edits,
STR/lease/sales publication, public covers and signed print routes. Provider and
AI output is synthetic; it makes no paid provider or PDF-generation calls and
sends no messages. Changing the directory client is verified not to change any
of those published snapshots. Run against a migrated preview using
`STAGING_BASE_URL` and the preview's Supabase environment credentials.

Release checks passed: 1,903 unit tests, production build, TypeScript, lint (no
errors), SQL isolation/concurrency checks and the live publication flow above.
The 262 pre-existing report records and 28 proposal versions retained identical
snapshot/PDF checksums after migration and QA. Billing remains disabled, with no
metered accounts or usage events. The existing navigation is retained with one
Clients link added.

## Client merges and unique email addresses

Apply `20261016002517_client_merge_and_email_identity.sql` first. Review any
same-agency duplicate email groups and merge only confirmed duplicates through
`merge_agency_clients` with the service role, explicit source/target IDs and both
current `updated_at` values. Then apply
`20261016002520_client_email_unique_index.sql`. The index intentionally fails if
unreviewed duplicates remain; migrations never guess which client to keep.
Production applies both phases and the explicitly authorised merge in one
transaction, recording each migration only after its statements succeed.

A merged contact is retained as an immutable, archived alias. Directory results
show only the canonical client, and client history includes reports and leads
linked to either ID. Existing reports, recipient snapshots, properties, leads,
published versions, public links and PDFs are not rewritten. Selecting an old
client ID or creating another report from an older appraisal resolves the current
client while retaining that appraisal's saved recipient details.

A unique index enforces one nonblank, trimmed, case-insensitive email per agency
across active and archived canonical clients. Accounts remain separate, and
clients without email are allowed. Archiving does not free an email for a second
record; restore the existing client instead. The shared picker and directory show
exact email matches with an explicit action to use or view the saved client.
Public calculator inputs still cannot overwrite directory details. Billing
configuration and usage are unaffected.

Both migrations were applied and recorded on 16 October 2026, with the reviewed
Cameron Mercer duplicate merged in the same transaction. Live checks confirm one
canonical client, combined history, duplicate creation rejected with HTTP 409,
and old selections/calculator identity resolving to that client. No billing was
enabled.

`client_directory_run.py` now also runs the merge fixtures/assertions and both
migration phases in a fresh disposable `staypack-clients-qa*` PostgreSQL 17
container. `client_directory_concurrency.py` checks four independent 12-session
cases, including repeatable-read transactions that all start with an empty
snapshot: exactly one insert succeeds and the unique index rejects the other 11.
Assertions cover merge retries, stale edits, alias tampering, agency isolation,
archived email collisions, STR/lease/sales carry-through and unchanged historical
rows. Application validation passed 1,911 unit tests, TypeScript, lint (no errors)
and the production build including all 74 required routes.

## Contacts and calculator enquiries

`20261016020354_contacts_and_calculator_enquiries.sql` separates the calculator
inbox from the saved Contacts directory. It was applied on 16 October 2026 before
the UI release. `/contacts` is the directory; old `/clients?client=...` links
redirect while preserving the selected contact. Existing private API/RPC names
remain compatible.

A new calculator enquiry never creates a contact. The insert trigger only links
an active canonical contact when the same-agency normalized email, name and any
supplied phone details agree. It does not edit contact data. Missing/conflicting
identities stay unlinked for review. There is no historical backfill.

**Save contact** uses an authenticated, service-only RPC that checks membership,
locks the enquiry and resolves an explicitly selected or newly entered contact.
Retries reuse its saved association. Saving creates no property or report and
never rewrites submitted enquiry details or an existing report recipient. A
subsequent Create report uses the saved contact for the new draft; archived
contacts require review. Existing report retries still return immediately.

Enquiry progress is separate from estimate delivery: New enquiry, Contact saved,
Draft created, Report published, Report unpublished or Report archived. Publication
is derived from actual proposal link/report state. Contact history counts all
reports, including merged aliases, separately as draft, published and archived;
the 50-row history limit does not limit totals. Contacts with zero reports can
start STR, lease or sales reports with their details already selected.

The migration changes functions and adds one insert trigger. It does not update
historical report/recipient rows, versions, public links, PDFs, properties or
billing. All new functions use security invoker with explicit grants and agency
checks; public visitors cannot call directory or enquiry RPCs.

The disposable SQL runner includes `contacts_enquiries_assertions.sql` for
no automatic contact creation, Save contact idempotency, reviewed identity
carry-through, progress, ownership and immutable publications. The concurrency
runner adds twelve simultaneous Save contact/Create report requests. The opt-in
`tests/staging/client-setup.spec.ts` exercises desktop/mobile saving, old URL
redirects, automatic linking, all three report pickers, publication and public/
print recipient snapshots in a disposable tenant, without paid provider calls.

## Stable proposal links and draft autosave

Apply `20261021065728_stable_proposal_share_links.sql`, then
`20261021084230_proposal_link_history_api_compatibility.sql` before releasing the
stable-link publisher. Both migrations have been verified in disposable
PostgreSQL 17 and were applied to `qmtfugaeujeikyegoxwi` on 21 October 2026.
Real API checks confirmed that the older unhinted link/version embeds and the
new history joins succeed after the compatibility migration. For future database
work, use the existing connection recorded in `AGENTS.md` and verify that target.

Draft edits save privately through the existing revision-checked save endpoint.
Publishing remains an explicit action: `publish_digital_proposal_v3` advances one
primary link to an immutable snapshot. The first deliberate publication adopts
the most recently issued active legacy link; other legacy links stay fixed.
Revoked links never become active again. Publishing after revocation creates a
new link. Reusing an earlier identical snapshot still records the latest published
revision and source fingerprint.

`digital_proposal_link_versions` records snapshots served by each link. Public
navigation, PDF and attachment URLs, and activity events retain the rendered
version so an already-open page remains coherent after another publication.
Historical snapshots and stored PDFs are not rewritten. The migration updates
event membership constraints, adds scoped RLS and service-only publishing/event
functions, and keeps archived proposals unavailable.

The follow-up gives the history table a surrogate primary key while retaining
its scoped unique constraint and the event membership foreign key. This prevents
PostgREST from inferring a second link-to-version relationship, preserving older
deployed applications' unhinted embeds during rollout. It preserves all history,
events, links, snapshots, PDF paths and access policies, then reloads the API
schema cache. New application queries also explicitly select the existing direct
foreign-key relationship.

Before the migration is installed, existing links, previews and draft saves
remain available; publishing returns an actionable migration-required error
instead of issuing another changing URL. The disposable SQL runner
`python3 supabase/tests/client_directory_run.py staypack-clients-qa` (against a
fresh dedicated container of that name) includes legacy-link backfill,
adoption, snapshot reuse, event attribution, revocation, isolation, archive and
API-compatibility key/data-preservation checks. The opt-in live suite is `lib/digital-proposals/integration.live.test.ts`;
run it only against an explicitly designated test environment.
