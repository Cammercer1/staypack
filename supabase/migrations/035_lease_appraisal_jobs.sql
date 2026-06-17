create table if not exists public.lease_appraisal_jobs (
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

create index if not exists lease_appraisal_jobs_listing_status_idx
on public.lease_appraisal_jobs (agency_id, listing_id, status, created_at desc);

create index if not exists lease_appraisal_jobs_created_at_idx
on public.lease_appraisal_jobs (created_at desc);

drop trigger if exists lease_appraisal_jobs_set_updated_at
on public.lease_appraisal_jobs;

create trigger lease_appraisal_jobs_set_updated_at
before update on public.lease_appraisal_jobs
for each row execute function public.set_updated_at();

alter table public.lease_appraisal_jobs enable row level security;

drop policy if exists "Members can view lease appraisal jobs"
on public.lease_appraisal_jobs;

create policy "Members can view lease appraisal jobs"
on public.lease_appraisal_jobs for select
using (public.is_agency_member(agency_id));

drop policy if exists "Members can create lease appraisal jobs"
on public.lease_appraisal_jobs;

create policy "Members can create lease appraisal jobs"
on public.lease_appraisal_jobs for insert
with check (public.is_agency_member(agency_id));
