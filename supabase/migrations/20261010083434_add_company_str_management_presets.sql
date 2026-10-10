-- Optional company assumptions. Reports retain their own independent snapshots.
set local lock_timeout = '5s';
alter table public.agencies
  add column if not exists str_management_presets jsonb not null default '[]'::jsonb
  check (jsonb_typeof(str_management_presets) = 'array' and jsonb_array_length(str_management_presets) <= 5);

comment on column public.agencies.str_management_presets is
  'Up to five named STR ADR/occupancy and availability presets. Applied explicitly by a report author; never automatically added to market estimates.';
