# GitHub checks and Cloudflare deployments

Work on a `codex/…` branch, push it, inspect its checks and private preview, then
merge a pull request into `main`. Production deploys automatically after the
checks pass. A branch push never deploys production. Netlify stays disabled.

The workflows are [`ci.yml`](../.github/workflows/ci.yml) (checks/build),
[`deploy.yml`](../.github/workflows/deploy.yml) (deploy after successful push CI)
and [`preview-cleanup.yml`](../.github/workflows/preview-cleanup.yml) (branch deletion).
See [ENVIRONMENT.md](ENVIRONMENT.md) for runtime secrets, public build variables
and local configuration; they are not synchronized automatically.

## Checks

`StayPack CI` runs on repository branch pushes:

- **Quality checks:** ESLint, TypeScript, unit tests and deployment-config tests.
- **Database checks:** existing workspace, publish/share, stable-link revocation,
  history, permissions and isolation assertions in an empty PostgreSQL 17 service.
- **Build and browser checks:** the real Cloudflare build and Chromium desktop/
  mobile UI regressions, plus preview authentication and endpoint isolation.
  On `main`, it also builds the production application and public report Worker.

The PostgreSQL service is disposable, contains fixture data only, and does not
connect to either hosted Supabase project. It emulates the database roles needed
by these assertions; it is not a complete hosted Supabase/Auth/Storage deployment
or a test of every historical migration. Hosted migrations remain a separately
reviewed release step. CI never applies migrations to production.

Provider calls, customer email, real billing and production PDFs are not run by
this pipeline. Unit tests cover their behavior; framework/provider changes still
need the authorized live integration/PDF checks described in the
[project README](../README.md).

Only successful **push-triggered** CI runs deploy. `workflow_dispatch` runs checks
and builds without deploying. To retry deployment or refresh a preview secret,
rerun the original push CI run while its commit is still the branch head; source
artifacts expire after one day. A new authorized push also runs the full workflow.

## Private previews

Successful branch checks deploy one stable URL per branch, recorded under GitHub
Deployments and in the **StayPack Deploy** job summary. Use username `preview`
and the owner's separate preview password. Every request, including assets,
requires authentication; responses disable caching and indexing. Version preview
URLs are disabled. Deleting the branch removes its Worker automatically.

The preview opens `/dev/branch-preview`. Click **Start mock test session**, then
select dashboard, STR workspace, lease/sales editor or another fixture screen.
These are the actual UI components with synthetic records. Saves remain in that
tab's memory and reset on reload. The dashboard's normal application links are
not live navigation: use the preview's screen selector.

The same Chromium suite can verify a deployed private preview. Set
`CI_PREVIEW_URL` to its workers.dev origin and `CI_PREVIEW_PASSWORD` securely in
the process environment, then run `npx playwright test --config playwright.ci.config.ts`.
The configuration rejects production/custom-domain targets and starts no local
server in this mode. Never put the password in a command argument, URL or log.

No preview receives customer records, a hosted Supabase connection, service-role
keys, provider credentials, queue bindings, cron triggers or production routes.
The server blocks live API and application routes, and browser connections are
restricted to the preview origin. This is a UI preview, not a persistent staging
backend; publishing, real authentication and background execution require the
separate integration checks. Both existing free Supabase projects stay intact.

## Deployment security

Build jobs receive no deployment or application server secrets. Artifacts expire
after one day. The privileged `workflow_run` job uses the deployment script and
configuration from `main`, verifies the successful source run and current branch
SHA, and treats the downloaded output as data. It never runs scripts or uses
Wrangler configuration from a branch artifact. Actions are pinned by commit;
Wrangler is pinned to 4.158.0. Fork workflows cannot deploy.

The GitHub environment **cloudflare-deploy** accepts only the `main` branch and
holds `CLOUDFLARE_API_TOKEN` and `BRANCH_PREVIEW_ACCESS_KEY`. Branch workflows
cannot read these secrets. `PRODUCTION_SUPABASE_ANON_KEY` is a repository variable
because it is the intentionally public browser key, not a service-role key.
Cloudflare retains production runtime secrets across deployments. A public
repository does not make environment secret values public.

The Cloudflare token needs Workers Scripts Edit, Queues Edit and Account Settings
Read on the existing account; Workers Routes Edit and Zone Read are restricted
to `staypack.app`. Rotate/revoke it in Cloudflare and replace the matching GitHub
environment secret. Rotate the preview password there and rerun each active
branch's CI to update its deployed secret. Never put either value in Git or a URL.

## Production verification and recovery

Deployments publish the public-report Worker, then the app, preserving the app's
specific `/proposal/print/*` route and existing queue/cron configuration. The job
checks the exact release SHA on `/login`, public report delivery, anonymous
access denial for the dashboard, and absence of preview screens on production.
If deployment or smoke checks fail, it restores the previous versions of both
Workers. A failed build leaves production untouched; stale branch builds are
skipped. Inspect the failed Actions run before retrying.

A successful deployment does not roll back SQL or external provider effects.
For a code regression after deployment, revert the merge with a new PR and let
checks redeploy it, or use the authorized manual Worker rollback in the
[operations guide](README.md).
Main requires the three CI checks and a pull request; force pushes and deletion
are disabled. No additional review is required for this single-owner workflow.

This uses the existing Cloudflare Workers Paid plan, standard GitHub-hosted Linux
runners for the public repository, and no additional hosted database. Preview
requests count toward existing Workers usage; branch cleanup avoids accumulating
unused Workers. It does not introduce a new plan or subscription.
