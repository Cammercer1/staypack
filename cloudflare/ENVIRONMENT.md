# Environment variables and secrets

The production application is hosted on Cloudflare Workers. Netlify variables
were migrated once; Netlify, Cloudflare, GitHub and local dotenv files do **not**
automatically synchronize. A code commit does not create or rotate a runtime
secret. This guide describes the setup verified on 9 November 2026.

## Where each setting lives

| Settings | Authoritative location | Purpose |
| --- | --- | --- |
| Application runtime credentials | Cloudflare Worker **staypack-app**, encrypted secrets | Supabase, R2, Browserless, property/estimate/copy providers, email and billing |
| Public-report runtime credentials | Cloudflare Worker **staypack-public-reports**, encrypted secrets | Its own `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for fresh access checks and report reads |
| Routes, bindings, schedules and non-sensitive runtime flags | [`wrangler.app.jsonc`](../wrangler.app.jsonc), [`cloudflare/wrangler.jsonc`](wrangler.jsonc) | Versioned production infrastructure configuration |
| Public browser key | GitHub repository variable **PRODUCTION_SUPABASE_ANON_KEY** | Mapped to `NEXT_PUBLIC_SUPABASE_ANON_KEY` for production builds |
| Public build URLs | [`scripts/ci/build.mjs`](../scripts/ci/build.mjs) | Production Supabase URL and site/report origins; synthetic values for previews |
| Deployment credential and preview password | GitHub environment **cloudflare-deploy**, restricted to `main` | Encrypted `CLOUDFLARE_API_TOKEN` and `BRANCH_PREVIEW_ACCESS_KEY` |
| Local development values | Ignored `.env.local`; ignored `.dev.vars` where local Workers tooling requires it | Local processes only; [`.env.example`](../.env.example) documents names and sample defaults |

The runtime secrets include private keys such as `SUPABASE_SERVICE_ROLE_KEY`,
`R2_SECRET_ACCESS_KEY`, `BROWSERLESS_API_KEY`, provider API keys,
`RESEND_API_KEY` and Stripe secrets. Several non-sensitive provider settings are
also stored as encrypted settings alongside them. The app's Supabase URL and
anon key are present at runtime as well as in the browser build. The anon key is
intentionally public; the service-role key must never enter a browser build.

Production uses Supabase project **qmtfugaeujeikyegoxwi** for database/Auth/RLS
and R2 for files (`STORAGE_PROVIDER=r2`). Browserless remains the PDF renderer.
Neither the database nor these external services moved into the application
Worker. Legacy files may still have Supabase Storage URLs.

The app configuration sets `APP_ENV=production`, `CLOUDFLARE_APP=1`,
`SCHEDULES_ENABLED=1`, and `SITE_URL`, `NEXT_PUBLIC_SITE_URL` and
`NEXT_PUBLIC_REPORTS_URL` to `https://staypack.app`. CI injects `RELEASE_SHA`.
`BILLING_MODE` remains `disabled` in runtime secrets; migration and ordinary
deployment do not activate billing. No customer-delivery email cron is enabled.

Not every `.env.example` entry needs a hosted override: optional values can use
code defaults. For example, `RAPIDAPI_REA_MAX_LISTINGS` defaults to 100, matching
the former Netlify setting. Node 24 is selected by GitHub Actions, Docker and
`.nvmrc`; it is a build-tool requirement, not a Netlify variable that selects the
Cloudflare runtime.

## What a deployment changes

Normal releases use [GitHub Actions](CI.md). Builds receive the public settings
they need, not application server credentials. [`scripts/ci/deploy.mjs`](../scripts/ci/deploy.mjs)
publishes checked artifacts and retains the existing Cloudflare runtime secrets.
It does not read or upload a developer's `.env.local`.

The manual [`scripts/deploy-cloudflare-app.mjs`](../scripts/deploy-cloudflare-app.mjs)
is different: it reads `.env.local` and the process environment, selects a fixed
allowlist, and uploads nonempty values as Worker secrets with the application.
Its temporary mode-0600 JSON file is removed afterwards. **An old local value can
overwrite a newer Cloudflare value.** Verify those values before an authorized
manual recovery; do not use this bulk path merely to change one hosted setting.
The report deployment command builds/deploys code and preserves its separately
configured secrets; it does not copy secrets from `staypack-app`.

## Changing or rotating a value

1. Identify every consumer. A provider key usually belongs to `staypack-app`;
   the Supabase service-role credential is used by **both** production Workers.
2. Update runtime secrets on the correct Worker through the existing authorized
   Cloudflare account. In the dashboard, open **Workers & Pages → the Worker →
   Settings → Variables and Secrets**, choose **Secret**, then deploy the change.
   Secret values are hidden after saving; inspect names and verify behavior
   without printing values. See [Cloudflare's secret configuration guide](https://developers.cloudflare.com/workers/configuration/secrets/).
3. For shared credentials, update every consuming Worker and the authorized local
   copies before retiring the old credential. A change on one Worker does not
   update the other.
4. If a public build value changes, update its GitHub variable or the build script,
   plus matching runtime settings where used, and run a production rebuild through
   the normal release workflow. A runtime-only change cannot replace a key already
   embedded in browser JavaScript.
5. Verify the affected feature. Changes to Supabase/report access require published
   and revoked-report checks; Browserless changes require a real PDF check when
   authorized. Never include secret values in logs, screenshots, URLs or commits.

For a new setting, document its name and purpose in `.env.example`, install its
runtime value on the consuming Worker, and update build mappings only if it is
intentionally public. Extend the manual deployment allowlist if that recovery
path must carry it. Keep routes and non-sensitive configuration in the versioned
Wrangler files so subsequent deployments remain reproducible.

Rotate `CLOUDFLARE_API_TOKEN` in Cloudflare and replace it in GitHub's
`cloudflare-deploy` environment. Rotate the preview password there and rerun the
original push-triggered CI runs for active branches to redeploy their password.
These credentials belong to deployment infrastructure, not application runtime.

## Local development and private previews

Copy `.env.example` only when `.env.local` does not already exist. The template
contains local/sample defaults, not a complete inventory of production values.
Missing provider keys enable mocks where supported; this does not isolate a
configured database. Check the target before running any script that writes data.

Automatic branch previews use synthetic fixtures, `https://preview.invalid` and
a fake browser key. They have no hosted database, service-role/provider keys,
queues or cron triggers. Changes stay in the tab and reset on reload. CI database
checks use disposable PostgreSQL. Both existing free Supabase projects remain
in use; neither is a preview database. See [CI.md](CI.md) for preview access and
the limits of these checks.

Do not restore Netlify settings or schedules for routine releases. Root
`wrangler.jsonc` describes legacy private QA; it is not the production config or
the generated automatic-preview config. Historical migration commands are in
[HISTORY.md](HISTORY.md), not the current deployment procedure.
