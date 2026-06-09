create table if not exists public.account_template_grants (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  template_id text not null,
  product text not null check (
    product in ('str', 'lease', 'sales_brochure', 'rental_brochure')
  ),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (agency_id, template_id)
);

create index if not exists account_template_grants_agency_id_idx
  on public.account_template_grants (agency_id);

create index if not exists account_template_grants_product_idx
  on public.account_template_grants (agency_id, product);

alter table public.account_template_grants enable row level security;

create policy "Agency members can read template grants"
  on public.account_template_grants
  for select
  using (
    exists (
      select 1
      from public.agency_members m
      where m.agency_id = account_template_grants.agency_id
        and m.user_id = auth.uid()
    )
  );

comment on table public.account_template_grants is
  'Account-scoped template entitlements (e.g. Haven bespoke layouts). Platform templates need no grant row.';

-- Haven managed-delivery shadow agency (provisioned as md-havenly)
insert into public.account_template_grants (agency_id, template_id, product, is_default)
select a.id, 'haven-properties-str', 'str', true
from public.agencies a
where a.slug = 'md-havenly'
on conflict (agency_id, template_id) do nothing;

insert into public.account_template_grants (agency_id, template_id, product, is_default)
select a.id, 'haven-properties-lease-appraisal', 'lease', true
from public.agencies a
where a.slug = 'md-havenly'
on conflict (agency_id, template_id) do nothing;
