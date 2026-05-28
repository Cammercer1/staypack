-- Per-channel image selections (landing page, STR report, brochures, etc.)

alter table public.listings
  add column if not exists collateral_image_selections jsonb not null default '{}'::jsonb;
