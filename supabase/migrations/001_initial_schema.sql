create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website_url text,
  email text,
  phone text,
  logo_url text,
  primary_colour text not null default '#111111',
  secondary_colour text not null default '#FFFFFF',
  accent_colour text not null default '#F4F4F5',
  font_family text not null default 'inter',
  font_file_url text,
  heading_font_family text not null default 'fraunces',
  body_font_family text not null default 'inter',
  heading_font_file_url text,
  body_font_file_url text,
  text_colour text not null default '#002e36',
  background_colour text not null default '#f9f5ea',
  default_report_title text not null default 'Short-Term Rental Potential Report',
  default_cta text not null default 'Speak with the agent for the full buyer pack and property details.',
  default_disclaimer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (agency_id, user_id)
);

create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role_title text,
  photo_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  report_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  source_url text not null,
  status text not null check (status in ('pending', 'success', 'failed')),
  method text,
  parser_name text,
  raw_html_storage_path text,
  extracted_json jsonb,
  warnings text[] default '{}',
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'scraped', 'estimated', 'generated', 'published', 'failed', 'archived')),
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
  public_slug text,
  public_url text,
  qr_code_url text,
  pdf_url text,
  scraped_listing_json jsonb,
  raw_airbtics_json jsonb,
  original_estimate_json jsonb,
  user_overrides_json jsonb,
  final_estimate_json jsonb,
  ai_copy_json jsonb,
  final_report_json jsonb,
  error_message text,
  generated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, public_slug)
);

alter table public.scrape_jobs
  add constraint scrape_jobs_report_id_fkey
  foreign key (report_id) references public.reports(id) on delete cascade;

create table if not exists public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create trigger agencies_set_updated_at
before update on public.agencies
for each row execute function public.set_updated_at();

create trigger agent_profiles_set_updated_at
before update on public.agent_profiles
for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_members
    where agency_id = target_agency_id
    and user_id = auth.uid()
  );
$$;

create or replace function public.is_agency_admin(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_members
    where agency_id = target_agency_id
    and user_id = auth.uid()
    and role in ('owner', 'admin')
  );
$$;

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.scrape_jobs enable row level security;
alter table public.reports enable row level security;
alter table public.report_events enable row level security;

create policy "Members can view their agencies"
on public.agencies for select
using (
  exists (
    select 1
    from public.agency_members
    where agency_members.agency_id = agencies.id
      and agency_members.user_id = auth.uid()
  )
);

create policy "Admins can update their agencies"
on public.agencies for update
using (public.is_agency_admin(id));

create policy "Authenticated users can create agencies"
on public.agencies for insert
with check (auth.uid() is not null);

create policy "Members can view agency memberships"
on public.agency_members for select
using (public.is_agency_member(agency_id) or user_id = auth.uid());

create policy "Users can create their own membership"
on public.agency_members for insert
with check (user_id = auth.uid());

create policy "Admins can manage agency memberships"
on public.agency_members for update
using (public.is_agency_admin(agency_id));

create policy "Members can view agent profiles"
on public.agent_profiles for select
using (public.is_agency_member(agency_id));

create policy "Members can create agent profiles"
on public.agent_profiles for insert
with check (public.is_agency_member(agency_id));

create policy "Admins can update agent profiles"
on public.agent_profiles for update
using (public.is_agency_admin(agency_id));

create policy "Admins can delete agent profiles"
on public.agent_profiles for delete
using (public.is_agency_admin(agency_id));

create policy "Members can view scrape jobs"
on public.scrape_jobs for select
using (public.is_agency_member(agency_id));

create policy "Members can insert scrape jobs"
on public.scrape_jobs for insert
with check (public.is_agency_member(agency_id));

create policy "Members can view reports"
on public.reports for select
using (public.is_agency_member(agency_id));

create policy "Members can create reports"
on public.reports for insert
with check (public.is_agency_member(agency_id));

create policy "Members can update reports"
on public.reports for update
using (public.is_agency_member(agency_id));

create policy "Admins can delete reports"
on public.reports for delete
using (public.is_agency_admin(agency_id));

create policy "Members can view report events"
on public.report_events for select
using (public.is_agency_member(agency_id));

create policy "Members can insert report events"
on public.report_events for insert
with check (public.is_agency_member(agency_id));
