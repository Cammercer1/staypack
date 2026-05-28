alter table public.agencies
  add column if not exists brand_advanced_json jsonb not null default '{}';

comment on column public.agencies.brand_advanced_json is
  'Optional advanced UI tokens (buttons, radii, links) for landing pages and collateral.';
