<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# StayPacks

Branded short-term rental potential reports for real estate agencies. Next.js App Router SaaS with Supabase backend.

## Commands

- `npm install` — install dependencies (Node >= 20.9)
- `npm run dev` — local dev server at http://localhost:3000
- `npm run build` — production build (runs env verification first)
- `npm run lint` — ESLint
- `npm test` — Vitest unit tests
- Supabase migrations live in `supabase/migrations/` — see `supabase/README.md`

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS 4, shadcn/ui
- Supabase Auth, Postgres, Storage, RLS
- Server routes for scraping, Airbtics, OpenAI, Browserless, Bright Data
- Hosted on Netlify; canonical public URL is `https://staypack.app`

## Architecture

```
app/(app)/          — authenticated dashboard (listings, reports, settings)
app/(public)/       — published reports, print routes, collateral
app/api/            — server route handlers (secrets stay here)
lib/                — business logic, scraping, templates, delivery
components/         — React UI
supabase/migrations — SQL schema
netlify/functions/  — background jobs
```

- Do **not** use n8n. The app handles the full flow itself.
- Supabase is the source of truth.
- Never call third-party APIs from the browser. All Airbtics, OpenAI, Browserless, Google, and Supabase service-role keys stay server-side.
- Published reports render from `final_report_json` so old reports stay stable.
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

Copy `.env.example` to `.env.local`. Dev mocks activate automatically when third-party API keys are missing.
