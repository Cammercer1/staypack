-- Shared, server-only cache for public comparable-search results.
-- No agency or user data is stored here. RLS intentionally exposes no rows to
-- browser clients; only the service-role appraisal jobs can read or write it.
create table if not exists public.comparable_search_cache (
  cache_key text primary key,
  provider text not null check (provider in ('apify_rea')),
  actor_id text not null,
  request_json jsonb not null,
  records_json jsonb not null check (jsonb_typeof(records_json) = 'array'),
  item_count integer not null default 0 check (item_count >= 0 and item_count <= 100),
  fetched_at timestamptz not null default now(),
  fresh_until timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists comparable_search_cache_fresh_until_idx
on public.comparable_search_cache (fresh_until);

create index if not exists comparable_search_cache_expires_at_idx
on public.comparable_search_cache (expires_at);

alter table public.comparable_search_cache enable row level security;

revoke all on table public.comparable_search_cache from anon, authenticated;

comment on table public.comparable_search_cache is
  'Server-only cache of public REA comparable search responses; excludes credentials and customer data.';
