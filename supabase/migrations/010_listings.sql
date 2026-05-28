-- Listings as top-level property context; reports become STR collateral linked to listings.

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  listing_url text,
  property_address text,
  suburb text,
  state text,
  postcode text,
  country text default 'Australia',
  latitude numeric,
  longitude numeric,
  property_type text,
  bedrooms numeric,
  bathrooms numeric,
  car_spaces numeric,
  accommodates numeric,
  listing_title text,
  listing_description text,
  display_price text,
  hero_image_url text,
  selected_image_urls text[] default '{}',
  uploaded_image_urls text[] default '{}',
  scraped_listing_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

-- Add listing_id to reports (nullable during backfill)
alter table public.reports
  add column if not exists listing_id uuid references public.listings(id) on delete cascade;

-- Backfill: one listing per existing report
do $$
declare
  r record;
  new_listing_id uuid;
begin
  for r in select * from public.reports where listing_id is null loop
    insert into public.listings (
      agency_id,
      created_by,
      agent_profile_id,
      status,
      listing_url,
      property_address,
      suburb,
      state,
      postcode,
      country,
      latitude,
      longitude,
      property_type,
      bedrooms,
      bathrooms,
      car_spaces,
      accommodates,
      listing_title,
      listing_description,
      display_price,
      hero_image_url,
      selected_image_urls,
      uploaded_image_urls,
      scraped_listing_json,
      created_at,
      updated_at
    ) values (
      r.agency_id,
      r.created_by,
      r.agent_profile_id,
      case when r.status = 'archived' then 'archived' else 'active' end,
      r.listing_url,
      r.property_address,
      r.suburb,
      r.state,
      r.postcode,
      r.country,
      r.latitude,
      r.longitude,
      r.property_type,
      r.bedrooms,
      r.bathrooms,
      r.car_spaces,
      r.accommodates,
      r.listing_title,
      r.listing_description,
      r.display_price,
      r.hero_image_url,
      coalesce(r.selected_image_urls, '{}'),
      coalesce(r.uploaded_image_urls, '{}'),
      r.scraped_listing_json,
      r.created_at,
      r.updated_at
    )
    returning id into new_listing_id;

    update public.reports
    set listing_id = new_listing_id
    where id = r.id;
  end loop;
end $$;

alter table public.reports
  alter column listing_id set not null;

-- Add listing_id to scrape_jobs
alter table public.scrape_jobs
  add column if not exists listing_id uuid references public.listings(id) on delete cascade;

update public.scrape_jobs sj
set listing_id = r.listing_id
from public.reports r
where sj.report_id = r.id
  and sj.listing_id is null;

-- Drop property columns from reports (now on listings)
alter table public.reports
  drop column if exists listing_url,
  drop column if exists property_address,
  drop column if exists suburb,
  drop column if exists state,
  drop column if exists postcode,
  drop column if exists country,
  drop column if exists latitude,
  drop column if exists longitude,
  drop column if exists property_type,
  drop column if exists bedrooms,
  drop column if exists bathrooms,
  drop column if exists car_spaces,
  drop column if exists accommodates,
  drop column if exists listing_title,
  drop column if exists listing_description,
  drop column if exists display_price,
  drop column if exists hero_image_url,
  drop column if exists selected_image_urls,
  drop column if exists uploaded_image_urls,
  drop column if exists scraped_listing_json,
  drop column if exists agent_profile_id;

create index if not exists listings_agency_id_idx on public.listings (agency_id);
create index if not exists listings_status_idx on public.listings (agency_id, status);
create index if not exists reports_listing_id_idx on public.reports (listing_id);

alter table public.listings enable row level security;

create policy "Members can view listings"
on public.listings for select
using (public.is_agency_member(agency_id));

create policy "Members can create listings"
on public.listings for insert
with check (public.is_agency_member(agency_id));

create policy "Members can update listings"
on public.listings for update
using (public.is_agency_member(agency_id));

create policy "Admins can delete listings"
on public.listings for delete
using (public.is_agency_admin(agency_id));
