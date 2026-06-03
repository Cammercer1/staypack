-- Per-tenant brand kit for managed delivery (no app UI required).

alter table public.delivery_tenants
  add column if not exists brand_json jsonb not null default '{}'::jsonb;

comment on column public.delivery_tenants.brand_json is
  'Client brand kit (logo, colours, fonts, copy). Used for STR PDFs; overrides linked agency when set.';

-- Optional link to an existing StayPacks agency (e.g. if they also use the app).
alter table public.delivery_tenants
  alter column agency_id drop not null;
