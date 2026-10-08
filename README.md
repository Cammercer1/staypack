# StayPack

Branded short-term rental potential reports for real estate agencies.

## Stack

- Next.js App Router
- TypeScript, Tailwind CSS, shadcn/ui
- Supabase Auth, Postgres, Storage
- Server routes for scraping, Airbtics, OpenAI, Browserless

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
   Optional third-party keys can remain empty to use the existing development
   mocks. Private environment files are excluded from Git and Docker image builds.

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
- Listing scrape pipeline with static fetch + Browserless fallback stub
- Dev mocks for Airbtics, OpenAI copy, QR/PDF when third-party keys are missing
- Public report and print routes rendered from `final_report_json`

## Milestone status

### Milestone 1

- Auth, onboarding, brand settings, draft reports, scrape, review/edit, library, public page skeleton

### Milestone 2

- Airbtics estimate route (mock without key)
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

The route is available in development. A preview build must explicitly set `STAYPACK_REGRESSION_PREVIEW=1`; normal production builds return 404. Do not enable this flag on production. This does not create a separate Supabase environment or replace authenticated integration tests.

Run the browser checks sequentially against a mock-enabled preview:

```bash
npx playwright install chromium
STAGING_BASE_URL=https://YOUR-PREVIEW.netlify.app npm run test:staging
```

The suite covers all brochure template renders, pagination resets, brochure/report editing, wizard navigation, the mobile gallery, landing template save/cancel, listing and scraped agents, branding and font search, analytics, lead status, scrape progress, and the social agent picker. It also fails if an app API request escapes the mock layer. Playwright writes its report to `playwright-report/` and failure artifacts to `test-results/` (both ignored by Git and ESLint).
