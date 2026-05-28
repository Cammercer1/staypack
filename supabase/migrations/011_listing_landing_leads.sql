-- Listing landing pages, leads capture, and collateral registry.

alter table public.listings
  add column if not exists public_slug text,
  add column if not exists public_url text,
  add column if not exists landing_qr_code_url text,
  add column if not exists landing_published_at timestamptz;

-- Backfill slugs for existing listings (URL filled by app on next provision)
update public.listings
set public_slug = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
where public_slug is null;

alter table public.listings
  alter column public_slug set not null;

create unique index if not exists listings_agency_public_slug_idx
  on public.listings (agency_id, public_slug);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  status text not null default 'new'
    check (status in ('new', 'contacted')),
  source text not null default 'landing_page',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create table if not exists public.collateral_items (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  type text not null check (type in (
    'str_report',
    'sales_brochure',
    'investor_snapshot',
    'agent_business_card'
  )),
  status text not null default 'draft'
    check (status in ('draft', 'generated', 'published', 'archived')),
  report_id uuid references public.reports(id) on delete set null,
  template_id text,
  public_slug text,
  public_url text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, type)
);

create trigger collateral_items_set_updated_at
before update on public.collateral_items
for each row execute function public.set_updated_at();

-- Backfill STR report collateral items from existing reports
insert into public.collateral_items (
  listing_id,
  agency_id,
  type,
  status,
  report_id,
  public_slug,
  public_url,
  pdf_url,
  created_at,
  updated_at
)
select
  r.listing_id,
  r.agency_id,
  'str_report',
  case
    when r.status = 'published' then 'published'
    when r.status in ('generated', 'estimated') then 'generated'
    when r.status = 'archived' then 'archived'
    else 'draft'
  end,
  r.id,
  r.public_slug,
  r.public_url,
  r.pdf_url,
  r.created_at,
  r.updated_at
from public.reports r
where r.status <> 'archived'
  and not exists (
    select 1
    from public.collateral_items ci
    where ci.listing_id = r.listing_id
      and ci.type = 'str_report'
  );

create index if not exists leads_listing_id_idx on public.leads (listing_id);
create index if not exists leads_agency_id_idx on public.leads (agency_id);
create index if not exists collateral_items_listing_id_idx on public.collateral_items (listing_id);

alter table public.leads enable row level security;
alter table public.collateral_items enable row level security;

create policy "Members can view leads"
on public.leads for select
using (public.is_agency_member(agency_id));

create policy "Members can update leads"
on public.leads for update
using (public.is_agency_member(agency_id));

create policy "Members can view collateral items"
on public.collateral_items for select
using (public.is_agency_member(agency_id));

create policy "Members can create collateral items"
on public.collateral_items for insert
with check (public.is_agency_member(agency_id));

create policy "Members can update collateral items"
on public.collateral_items for update
using (public.is_agency_member(agency_id));

create policy "Admins can delete collateral items"
on public.collateral_items for delete
using (public.is_agency_admin(agency_id));
