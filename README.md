# StayPack

Branded short-term rental potential reports for real estate agencies.

## Stack

- Next.js App Router
- TypeScript, Tailwind CSS, shadcn/ui
- Supabase Auth, Postgres, Storage
- Server routes for scraping, AirROI, OpenAI, Browserless

## Container development

The app runs in a Node 24 container with hot reload. Source files stay in this
checkout, so edits made here appear immediately in the running app. Linux
dependencies, Next.js output, and the npm download cache live in Docker volumes,
separate from any host installation. The app runs as the non-root `node` user.
Container development uses Next.js's supported Webpack mode with one-second
file polling, so hot reload works across macOS Docker mounts. The regular
`npm run dev` and production build keep their existing Turbopack defaults.

### First start

1. Start a Docker runtime with Docker Compose v2 or newer. Docker Desktop works;
   on macOS, [Colima](https://colima.run/docs/installation/) is another option:

   ```bash
   brew install colima docker docker-compose docker-buildx
   mkdir -p ~/.docker/cli-plugins
   ln -sfn "$(brew --prefix)/opt/docker-compose/bin/docker-compose" ~/.docker/cli-plugins/docker-compose
   ln -sfn "$(brew --prefix)/opt/docker-buildx/bin/docker-buildx" ~/.docker/cli-plugins/docker-buildx
   colima start --cpus 4 --memory 6
   ```

2. Create your private environment file if it does not already exist:

   ```bash
   test -f .env.local || cp .env.example .env.local
   ```

   Fill in the Supabase URL and keys for your development project using
   [supabase/README.md](supabase/README.md). Docker uses the project configured in
   `.env.local`; it does not create a separate database or apply migrations.
   Copy and PDF keys can remain empty to use development mocks. New STR estimates
   require `AIRROI_API_KEY`. Private environment files are excluded from Git and Docker image builds.

3. Start the app:

   ```bash
   docker compose up --build --detach --wait --wait-timeout 600
   ```

   Open [http://localhost:3000](http://localhost:3000). The first start installs
   dependencies with `npm ci`; subsequent starts reuse them unless the package
   manifests or Node runtime changed. The server is exposed only on this computer.

### Daily workflow

Run these from this checkout's terminal (including the terminal in Codex):

```bash
docker compose logs --follow app       # View server logs
docker compose exec app bash           # Open a container shell
docker compose exec app npm test       # Run unit tests
docker compose exec app npm run lint   # Run ESLint
docker compose exec app npm run build  # Check the production build
docker compose down                   # Stop; preserve dependency/cache volumes
```

If Node is installed on your host, the `npm run container:up`, `container:down`,
`container:logs`, `container:shell`, `container:test`, and `container:lint` aliases
run the same Docker commands. A host Node installation is otherwise unnecessary.

Add packages with `docker compose exec app npm install <package>` so the
manifests update in this checkout and dependencies install inside the container.
After pulling dependency changes, run `docker compose restart app` to refresh
them from the lockfile. After editing `.env.local`, run
`docker compose up --detach --force-recreate --wait --wait-timeout 600` to reload
the container environment. After changing `Dockerfile.dev` or the entrypoint,
rerun the first-start command to rebuild the image.

For VS Code or another editor supporting Dev Containers, use **Reopen in
Container**. The checked-in `.devcontainer/devcontainer.json` uses the same
Compose service and starts the dev server automatically.

PDF generation still uses Browserless. A hosted Browserless instance cannot
reach your laptop's `localhost`; the existing mock PDF path is available without
its API key. Real PDF testing requires a Browserless setup that can reach the
local app. Netlify background functions and scheduled delivery jobs are not
started by `next dev`.

## Local setup without Docker

Use Node 24 (`nvm use` reads `.nvmrc`), matching the container and Netlify runtime.

1. Install dependencies:

```bash
npm ci
```

2. Copy environment variables:

```bash
test -f .env.local || cp .env.example .env.local
```

3. Set up Supabase using [supabase/README.md](supabase/README.md).

4. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What works now

- Email auth, agency onboarding, brand settings, agent profiles
- Report library and 5-step report wizard
- Rental and sales appraisals accept manually entered properties; saved property details take precedence over imported facts, and changed details require refreshed comparables
- Listing scrape pipeline with static fetch + Browserless fallback stub
- AirROI STR estimates with ADR/occupancy adjustments and selectable report comparables
- Dev mocks for OpenAI copy and QR/PDF when third-party keys are missing
- Public report and print routes rendered from `final_report_json`
- Optional QR destinations chosen independently for each report, brochure, or business card; new documents default to no QR

## STR estimates and comparable selection

Add `AIRROI_API_KEY` to the server environment for new estimates. Both the dashboard
and managed delivery use `/lib/str/estimate.ts`; the former Airbtics endpoint remains
an alias of `/api/str/estimate`. No database migration is required. Existing reports
keep their saved estimates until edited or re-estimated after property input changes.

The calculator's headline revenue is the baseline (not its p50 percentile). The
starting effective ADR is reconciled to that headline and occupancy. Provider ADR
and percentile curves remain in the original payload for audit. Automatic visual
percentile positioning is not used: the image assessment pilot has not validated
revenue uplifts. Agents adjust ADR and occupancy; the server calculates annual
estimated gross STR revenue as ADR × occupancy / 100 × 365, before operating costs.
Rounded booked-night counts never enter the calculation. Reset restores the saved
market baseline without a provider request. The estimate screen has no paid refresh
action. If changed property inputs require a new estimate, agent assumptions and
selected comparables still present in the new pool are preserved. Comparable selection alone never reprices a report.
No provider or model calls are made when adjusting or selecting comparables.
Monthly revenue uses labelled modelled seasonal weights. A separate market lookup
and occupancy request adds the latest 12 completed months of occupancy medians and
25th–75th percentile bands, filtered to the same bedroom count and property type
where recognised. The chart names the resolved city market and dates; it is market
history, not a forecast for the subject or the selected comparables. Missing months
are left blank and unavailable history falls back to the annual revenue range.
Monthly ADR history is not included. The API does not supply monthly sample counts.

At published standard API rates, a new estimate plus occupancy history costs 31
cents (20 calculator + 1 market resolution + 10 occupancy).
Refreshing the same property reuses its saved occupancy benchmark for seven days.
Confirmed insufficient-data responses are also remembered for seven days, so an
unchanged report refresh does not repeat a known empty occupancy query. Temporary
errors remain retryable on a subsequent refresh. Each generation makes at most one
calculator request, one market resolution and one occupancy request. There are no
automatic paid retries or broader-property-type fallback requests. This bounds
AirROI requests to 31 cents per generation at those rates; it does not include AI
copy-generation costs or subsequent estimates after property input changes. History reuse currently applies to
the saved report, not a shared cache across different properties.

The estimate step keeps the complete returned comparable pool, ranks similar homes
first, flags limited booked activity or blocked availability, and lets agents choose
one to six listings for the report. Reviews, amenities, stay lengths and recent
90-day activity provide additional context in the evidence selector. Selection changes
the evidence shown, not the estimated revenue. Raw responses and historical photo
assessments are retained in the existing estimate/enrichment JSON; chosen comparables are frozen
into `final_report_json`. Numeric listing IDs are decoded without rounding.

## Report links and retired property pages

Choose **Optional link and QR code** in the preview step. Reports can link to their own online version or a custom website. Brochures and business cards accept a custom URL. Save the choice, then publish the report or brochure to apply it. Business cards apply it when saved. PDF generation waits for pending report/brochure link choices to be published.

Saving a link draft does not change an existing published QR or PDF. New QR images use unique storage paths and encode that document's destination directly. Regenerating copy preserves the choice. Existing documents without link metadata keep their original QR assets until explicitly changed.

Property-page creation, enquiry capture/status editing, and landing-page analytics are retired. The main navigation, dashboard, property library, and workspace focus on reports. Existing public property pages and printed redirects continue working, with agent contact details replacing enquiry forms. Enquiry history is removed from Settings and the old enquiries page returns 404. Source code, database history, and old assets are retained; no database migration is required.

The full dependency inventory and rollout notes are in [the property-pages audit](docs/property-pages-deprecation-audit.md).

## Milestone status

### Milestone 1

- Auth, onboarding, brand settings, draft reports, scrape, review/edit, library, public page skeleton

### Milestone 2

- AirROI estimate route (requires server API key)
- Copy generation route (mock without key)
- Two-page report preview
- Publish flow with QR upload

### Milestone 3

- Browserless PDF route (mock without key)
- PDF stored in Supabase Storage when configured
- Print route with A4 CSS

## Your next steps

1. Create a Supabase project
2. Run the SQL migrations
3. Add Supabase keys to `.env.local`
4. Add third-party API keys as you obtain them

## Scripts

- `npm run dev` — start local development
- `npm run build` — production build
- `npm run lint` — ESLint

### Mock staging regression checks

`/dev/lint-regression` renders the real affected UI components with synthetic records. Click **Start mock test session** before selecting a test screen. All app API calls are intercepted in that tab; saves are kept in memory and reset on reload. Unhandled API calls fail closed. The landing-template iframe contains a fixture page; the modal's selection, cancellation, and save behaviour are tested separately from landing-page content.

The route is available in development. `/dev/document-print` also renders synthetic documents through the actual report/card/brochure print components, with optional `kind`, `template`, and `qr=on` parameters. A preview build must explicitly set `STAYPACK_REGRESSION_PREVIEW=1`; normal production builds return 404 for both routes. Do not enable this flag on production. This does not create a separate Supabase environment or replace authenticated integration tests.

Run the browser checks sequentially against a mock-enabled preview:

```bash
npx playwright install chromium
STAGING_BASE_URL=https://YOUR-PREVIEW.netlify.app npm run test:staging
```

The suite covers all brochure template renders, pagination resets, brochure/report editing, wizard navigation, the mobile gallery, landing template save/cancel, listing and scraped agents, branding and font search, analytics, lead status, scrape progress, and the social agent picker. It also fails if an app API request escapes the mock layer. Playwright writes its report to `playwright-report/` and failure artifacts to `test-results/` (both ignored by Git and ESLint).

The document-link scenarios cover all three report wizards, brochure publish/republish, independent business-card destinations, the simplified property workspace, mobile controls, invalid URLs, and save-failure recovery. Legacy component scenarios remain available only in the synthetic harness so the retained source can still be checked. Unit coverage in `lib/documents/` checks actual API handlers, builders, publishers, legacy redirects, headless delivery, immutable QR uploads, and all report and brochure templates with QR enabled and disabled.
