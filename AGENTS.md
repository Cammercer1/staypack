<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# StayPacks

Branded short-term rental potential reports for real estate agencies. Next.js App Router SaaS with Supabase backend.

## Current hosting and releases

- The whole production web app runs on **Cloudflare Workers Paid** at `https://staypack.app`. Netlify is disabled and retained only for an explicit rollback; do not deploy there or restore its schedules during routine work.
- `staypack-app` serves the homepage, login, dashboard, editors, APIs and private print routes. `staypack-public-reports` serves published reports and viewer assets. Preserve the app's explicit `/proposal/print/*` route ahead of the report Worker's broader `/proposal/*` route.
- Appraisal enrichment runs through Cloudflare Queues (`staypack-appraisals`, with `staypack-appraisals-dead` for failed deliveries). The app's Cron Trigger handles billing sync each minute and cache cleanup every five minutes. Billing remains disabled; no customer-delivery email schedule was enabled by the migration.
- Supabase still provides the database, Auth and RLS for project `qmtfugaeujeikyegoxwi`; production file storage is Cloudflare R2. Browserless still renders PDFs. Moving hosting did not move the database into Cloudflare.
- Start new work from current `origin/main` on a `codex/…` branch. Preserve existing work and verify the checkout before editing; old branches can still contain Netlify-era instructions.
- After an authorized commit/push, GitHub runs quality, database, build and browser checks and creates a password-protected synthetic UI preview. Merge a passing PR to `main` for automatic deployment of **both** Workers. Required checks and PR protection apply to administrators too. Deleting the branch removes its preview.
- Previews have no live database, provider credentials, queues or cron jobs; saves reset on reload. Both existing free Supabase projects are in use. Do not connect previews to either project or pause one to make room. Database CI uses disposable local PostgreSQL.
- Read [hosting and recovery](cloudflare/README.md), [environment ownership](cloudflare/ENVIRONMENT.md) and [CI/preview workflow](cloudflare/CI.md). These describe current operations; [migration history](cloudflare/HISTORY.md) and older Netlify deployment records are historical evidence.

## Commands

- `npm ci` — install locked dependencies (Node 24 LTS)
- `npm run container:up` — build/start the Docker development environment at http://localhost:3000
- `npm run container:down` — stop the Docker development environment
- With the container running, use `docker compose exec app <command>` for checks so they use Linux dependencies and Node 24.
- The raw Docker command above is for the primary checkout only. In a worktree, use `STAYPACK_DEV_PORT=3101 node scripts/container.mjs exec app <command>` (with that preview's chosen port). Start previews with `STAYPACK_DEV_PORT=3101 npm run container:up`; the helper isolates the Docker project and verifies its source folder. Port 3000 is reserved for the primary checkout.
- Run `npm run container:status` before diagnosing an old UI to confirm the checkout, branch, commit and Docker source. Use the same `STAYPACK_DEV_PORT` setting for worktree checks.
- `npm run dev` — local dev server at http://localhost:3000
- `npm run build` — Next.js compatibility/rollback build (runs env verification first)
- `npm run build:cloudflare` — production application build for Workers; run in the Node 24 container
- `npm run deploy:cloudflare` — deploy the checked application build using the authorized local Wrangler identity
- `npm run deploy:report-worker` — deploy the separate public report Worker and matching assets; shared report changes require both deployments. See `cloudflare/README.md` for credentials and verification.
- The manual deploy commands above are for an authorized recovery or one-off operation. Normal releases use `.github/workflows/ci.yml` and `deploy.yml`; branch cleanup uses `preview-cleanup.yml`.
- `npm run lint` — ESLint
- `npm test` — Vitest unit tests
- Supabase migrations live in `supabase/migrations/` — see `supabase/README.md`

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS 4, shadcn/ui
- Supabase Auth, Postgres and RLS; Cloudflare R2 file storage
- Server routes for scraping, Airbtics, OpenAI, Browserless, Bright Data
- Dashboard and APIs run on Cloudflare Workers Paid using pinned vinext; appraisal jobs use Queues and maintenance uses Cron Triggers. Public reports have a separate Worker. Netlify is disabled and retained for rollback. Canonical public URL is `https://staypack.app`.

## Architecture

```
app/(app)/          — authenticated dashboard (listings, reports, settings)
app/(public)/       — published reports, print routes, collateral
app/api/            — server route handlers (secrets stay here)
lib/                — business logic, scraping, templates, delivery
components/         — React UI
supabase/migrations — SQL schema
cloudflare/         — Workers entrypoints, durable appraisal jobs and scheduled maintenance
netlify/functions/  — legacy wrappers for rollback
```

- Do **not** use n8n. The app handles the full flow itself.
- Supabase is the source of truth.
- Never call third-party APIs from the browser. All Airbtics, OpenAI, Browserless, Google, and Supabase service-role keys stay server-side.
- Published reports render from `final_report_json` so old reports stay stable.
- Public report HTML and access decisions must never be cached. Every request checks publication/revocation/archive state against the primary database before using an immutable snapshot cache.
- Store original scraped data, user overrides, and final report JSON separately.
- Browserless is required for PDF generation; also used as fallback for JS-heavy scraping.
- Scraping should be resilient — if data is missing, users can enter it manually.

## Product and compliance rules

- Always refer to STR revenue as an **estimate** ("estimated gross STR revenue").
- Do **not** call revenue "profit" or imply guaranteed income, yield, or return.
- Every report must include a disclaimer. See `staypack_cursor_fullstack_scaffold_v2.md` for approved wording.
- Do not mention Airbtics or OpenAI in buyer-facing copy.
- Do not use client-side `window.print()` for final PDFs.

## Code conventions

- Match existing patterns in the file or directory you are editing.
- Keep changes minimal and focused — avoid unrelated refactors.
- Prefer extending existing `lib/` utilities over duplicating logic.
- Use Zod for validation, React Hook Form for forms.
- Co-locate tests as `*.test.ts` next to the module under test.
- Only create git commits when explicitly asked.

## Key directories by feature

- `lib/reports/` — report JSON building, templates, publishing
- `lib/scraping/` — listing scrape and parse pipeline
- `lib/airbtics/` — STR estimate integration
- `lib/lease-appraisal/` — lease appraisal reports
- `lib/sales-appraisal/` — sales appraisal reports
- `lib/collateral/` — brochures, business cards, social posts
- `lib/delivery/` — managed delivery tenants and cron jobs

## Environment

- **Production server values:** encrypted secrets on Cloudflare Worker `staypack-app` (Supabase service role, R2, Browserless, providers, email and billing). The report Worker separately needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Changes to a shared credential must reach every consuming Worker.
- **Versioned runtime configuration:** `wrangler.app.jsonc` and `cloudflare/wrangler.jsonc` own routes, bindings, schedules and non-sensitive settings. Root `wrangler.jsonc` is legacy private QA, not production or automatic branch previews.
- **GitHub deployment credentials:** the main-only `cloudflare-deploy` environment contains `CLOUDFLARE_API_TOKEN` and `BRANCH_PREVIEW_ACCESS_KEY`. Do not put application service credentials in branch builds.
- **Public build values:** repository variable `PRODUCTION_SUPABASE_ANON_KEY` becomes `NEXT_PUBLIC_SUPABASE_ANON_KEY` through `scripts/ci/build.mjs`; that script also supplies the public Supabase URL and site/report origins. Public-value changes require a rebuild and matching runtime settings where consumed. Never use a service-role key here.
- **Local development:** copy `.env.example` only if `.env.local` is absent; keep values private. Development mocks are used where supported when provider keys are missing. Local files, Netlify and Cloudflare are **not automatically synchronized**.
- Normal CI deploys preserve existing Cloudflare runtime secrets and never upload `.env.local`. Manual `scripts/deploy-cloudflare-app.mjs` does upload its allowlisted local values and can overwrite hosted values; check they are current before using it. Document/configure new settings in the correct place rather than assuming a Git commit creates a secret.
- Follow [ENVIRONMENT.md](cloudflare/ENVIRONMENT.md) for changes and rotation. Do not print values, commit dotenv files or place private keys under `NEXT_PUBLIC_`.

## Supabase connection

- The user-designated app-managed MCP connection for this project is `6248e75a-72af-4f21-a201-67559ec15726`. Reuse it when its tools are exposed.
- The repository-local `staypacks-supabase` MCP server in `.codex/config.toml` is also authenticated and restricted to this project's database. Use it for local CLI database work. Do not create another connection or start another sign-in flow without the user's request.
- StayPacks' Supabase project reference is `qmtfugaeujeikyegoxwi`. Verify this target before database work. The account-wide Supabase plugin may expose a different project; never substitute that project.
- This instruction records the intended connection, but does not bind the app's connection selection. If the designated connection's tools are not exposed in the current chat, report that limitation and ask the user to enable the existing connection rather than asking them to set it up again.
- Keep credentials out of this repository and its MCP configuration.
