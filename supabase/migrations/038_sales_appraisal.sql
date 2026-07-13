-- Sales appraisal collateral type (recently sold + for-sale REA comps for sale listings).
alter table public.collateral_items
  drop constraint if exists collateral_items_type_check;

alter table public.collateral_items
  add constraint collateral_items_type_check check (type in (
    'str_report',
    'sales_brochure',
    'rental_brochure',
    'lease_appraisal',
    'sales_appraisal',
    'social_posts',
    'investor_snapshot',
    'agent_business_card'
  ));

-- Allow sales_appraisal template grants.
alter table public.account_template_grants
  drop constraint if exists account_template_grants_product_check;

alter table public.account_template_grants
  add constraint account_template_grants_product_check check (
    product in ('str', 'lease', 'sales_appraisal', 'sales_brochure', 'rental_brochure')
  );

-- Background jobs for sales appraisal enrichment (mirror of lease_appraisal_jobs).
create table if not exists public.sales_appraisal_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  request_json jsonb not null default '{}'::jsonb,
  result_json jsonb,
  error_message text,
  started_at timestamptz,
  heartbeat_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_appraisal_jobs_listing_status_idx
on public.sales_appraisal_jobs (agency_id, listing_id, status, created_at desc);

create index if not exists sales_appraisal_jobs_created_at_idx
on public.sales_appraisal_jobs (created_at desc);

drop trigger if exists sales_appraisal_jobs_set_updated_at
on public.sales_appraisal_jobs;

create trigger sales_appraisal_jobs_set_updated_at
before update on public.sales_appraisal_jobs
for each row execute function public.set_updated_at();

alter table public.sales_appraisal_jobs enable row level security;

drop policy if exists "Members can view sales appraisal jobs"
on public.sales_appraisal_jobs;

create policy "Members can view sales appraisal jobs"
on public.sales_appraisal_jobs for select
using (public.is_agency_member(agency_id));

drop policy if exists "Members can create sales appraisal jobs"
on public.sales_appraisal_jobs;

create policy "Members can create sales appraisal jobs"
on public.sales_appraisal_jobs for insert
with check (public.is_agency_member(agency_id));
