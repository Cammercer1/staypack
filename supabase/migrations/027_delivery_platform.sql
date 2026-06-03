-- Managed delivery platform: multi-tenant scrape → STR → email

create table if not exists public.delivery_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  enabled boolean not null default true,
  timezone text not null default 'Australia/Sydney',
  scrape_enabled boolean not null default true,
  scrape_schedule jsonb not null default '{"type":"interval","intervalHours":24}'::jsonb,
  last_scrape_at timestamptz,
  partner_sources jsonb not null default '[]'::jsonb,
  email_recipients text[] not null default '{}',
  email_from text,
  email_subject_template text default 'STR report: {{address}}',
  str_template_pack_id text,
  deliverables text[] not null default array['str']::text[],
  billing_mode text not null default 'production'
    check (billing_mode in ('production', 'shadow', 'dry_run')),
  billing jsonb not null default '{}'::jsonb,
  feature_flags jsonb not null default '{}'::jsonb,
  reprocess_on_material_change boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger delivery_tenants_set_updated_at
before update on public.delivery_tenants
for each row execute function public.set_updated_at();

create table if not exists public.delivery_tenant_properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.delivery_tenants(id) on delete cascade,
  source_site text not null,
  source_listing_id text not null,
  listing_url text,
  status text not null default 'discovered'
    check (status in ('discovered', 'processing', 'delivered', 'failed', 'skipped')),
  content_fingerprint text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  delivered_at timestamptz,
  delivery_id text,
  report_id uuid references public.reports(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  last_error text,
  retry_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source_site, source_listing_id)
);

create index if not exists delivery_tenant_properties_tenant_status_idx
  on public.delivery_tenant_properties (tenant_id, status);

create trigger delivery_tenant_properties_set_updated_at
before update on public.delivery_tenant_properties
for each row execute function public.set_updated_at();

create table if not exists public.delivery_scrape_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.delivery_tenants(id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  billing_mode text not null default 'production'
    check (billing_mode in ('production', 'shadow', 'dry_run')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  listings_seen int not null default 0,
  listings_skipped int not null default 0,
  listings_processed int not null default 0,
  listings_failed int not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists delivery_scrape_runs_tenant_started_idx
  on public.delivery_scrape_runs (tenant_id, started_at desc);

create table if not exists public.delivery_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.delivery_tenants(id) on delete cascade,
  event_type text not null,
  quantity int not null default 1,
  source_listing_id text,
  delivery_id text,
  scrape_run_id uuid references public.delivery_scrape_runs(id) on delete set null,
  billing_mode text not null default 'production'
    check (billing_mode in ('production', 'shadow', 'dry_run')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (tenant_id, delivery_id, event_type)
);

create index if not exists delivery_usage_events_tenant_occurred_idx
  on public.delivery_usage_events (tenant_id, occurred_at desc);

-- Service role only (no RLS policies for anon/authenticated)
alter table public.delivery_tenants enable row level security;
alter table public.delivery_tenant_properties enable row level security;
alter table public.delivery_scrape_runs enable row level security;
alter table public.delivery_usage_events enable row level security;
