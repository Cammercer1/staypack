-- EMPTY DISPOSABLE DATABASE ONLY. Apply after str_workspace_fixture.sql and before
-- workspace/calculator migrations. These extend its deliberately minimal schema.
alter table public.agencies add column country_code text default 'AU';
create function public.is_agency_admin(target_agency_id uuid) returns boolean language sql stable as $$
  select public.is_agency_member(target_agency_id)
$$;
alter table public.listings alter column id set default gen_random_uuid();
alter table public.listings add column created_by uuid references auth.users(id),
  add column state text, add column postcode text,
  add column country text, add column bedrooms numeric, add column bathrooms numeric,
  add column accommodates numeric, add column latitude numeric, add column longitude numeric;
alter table public.reports add column original_estimate_json jsonb, add column final_estimate_json jsonb,
  add column str_enrichment_json jsonb, add column user_overrides_json jsonb;
