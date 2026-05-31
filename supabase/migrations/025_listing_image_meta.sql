-- Per-image role and label for brochure rendering (photo vs floor plan).

alter table public.listings
  add column if not exists listing_image_meta jsonb not null default '{}'::jsonb;
