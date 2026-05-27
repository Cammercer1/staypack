# Supabase setup

Run these steps after creating your Supabase project.

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run, in order:
   - `migrations/001_initial_schema.sql`
   - `migrations/002_storage_buckets.sql`
3. Enable the Email auth provider in Authentication → Providers.
4. Copy project URL, anon key, and service role key into `.env.local`.
5. Set local URLs:
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
   - `NEXT_PUBLIC_REPORTS_URL=http://localhost:3000`
   - `QR_CODE_BASE_URL=http://localhost:3000`

Optional later:

- Add `OPENAI_API_KEY`
- Add `AIRBTICS_API_KEY` and `AIRBTICS_BASE_URL`
- Add `BROWSERLESS_API_KEY` and `BROWSERLESS_BASE_URL`
- Add `GOOGLE_MAPS_API_KEY`

Without third-party keys, development mode returns mock estimate/copy/PDF data so the UI can be tested end-to-end.
