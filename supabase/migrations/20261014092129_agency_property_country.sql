-- Existing agencies and saved documents retain Australian defaults.
-- ISO country codes are text so future supported markets can be added without an enum migration.
alter table public.agencies add column country_code text not null default 'AU';
alter table public.agencies add constraint agencies_country_code_supported check (country_code in ('AU', 'US'));
comment on column public.agencies.country_code is 'Agency property search market (ISO 3166-1 alpha-2). Controls provider routing and search country; not a billing or tax jurisdiction.';
