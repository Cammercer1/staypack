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
- Add `AIRBTICS_API_KEY` and `AIRBTICS_BASE_URL`
- Add `BROWSERLESS_API_KEY` and `BROWSERLESS_BASE_URL`
- Add `GOOGLE_MAPS_API_KEY`

Without third-party keys, development mode returns mock estimate/copy/PDF data so the UI can be tested end-to-end.

## Migration history

The original numbered migrations were installed through the SQL editor. Do not
blindly replay them on the existing production database with `db push`; its CLI
history is not a baseline of those older installations.

The 9 October 2026 agent directory and separate property price migrations are
already applied and recorded in production. Their filenames match the recorded
versions. Deploying the application does not run migrations automatically.
