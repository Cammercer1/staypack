# StayPack

Branded short-term rental potential reports for real estate agencies.

## Stack

- Next.js App Router
- TypeScript, Tailwind CSS, shadcn/ui
- Supabase Auth, Postgres, Storage
- Server routes for scraping, Airbtics, OpenAI, Browserless

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
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
