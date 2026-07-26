-- Comparable search cache is shared by the interchangeable server-side REA
-- providers. Existing Apify rows remain valid.
alter table public.comparable_search_cache
  drop constraint if exists comparable_search_cache_provider_check;

alter table public.comparable_search_cache
  add constraint comparable_search_cache_provider_check
  check (provider in ('apify_rea', 'rapidapi_rea'));

comment on column public.comparable_search_cache.actor_id is
  'Provider identifier used in the cache key (Apify actor id or RapidAPI host).';
