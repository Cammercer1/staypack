-- Parent agency groups, inherited template grants, and per-product catalogue policy.
-- Existing agencies remain ungrouped and retain platform_plus_grants behaviour.

create table if not exists public.agency_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  brand_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agencies
  add column if not exists agency_group_id uuid
  references public.agency_groups(id) on delete set null;

create index if not exists agencies_agency_group_id_idx
  on public.agencies (agency_group_id);

create table if not exists public.agency_group_members (
  id uuid primary key default gen_random_uuid(),
  agency_group_id uuid not null references public.agency_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (agency_group_id, user_id)
);

create index if not exists agency_group_members_user_id_idx
  on public.agency_group_members (user_id);

create table if not exists public.agency_group_template_grants (
  id uuid primary key default gen_random_uuid(),
  agency_group_id uuid not null references public.agency_groups(id) on delete cascade,
  template_id text not null,
  product text not null check (
    product in ('str', 'lease', 'sales_appraisal', 'sales_brochure', 'rental_brochure')
  ),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (agency_group_id, template_id)
);

create index if not exists agency_group_template_grants_product_idx
  on public.agency_group_template_grants (agency_group_id, product);

create unique index if not exists agency_group_template_grants_one_default_idx
  on public.agency_group_template_grants (agency_group_id, product)
  where is_default = true;

create table if not exists public.agency_group_product_settings (
  agency_group_id uuid not null references public.agency_groups(id) on delete cascade,
  product text not null check (
    product in ('str', 'lease', 'sales_appraisal', 'sales_brochure', 'rental_brochure')
  ),
  catalog_mode text not null default 'platform_plus_grants' check (
    catalog_mode in ('platform_plus_grants', 'grants_only')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_group_id, product)
);

create table if not exists public.agency_product_settings (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  product text not null check (
    product in ('str', 'lease', 'sales_appraisal', 'sales_brochure', 'rental_brochure')
  ),
  catalog_mode text not null default 'platform_plus_grants' check (
    catalog_mode in ('platform_plus_grants', 'grants_only')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, product)
);

-- Repair any historical duplicate defaults before enforcing one per office/product.
with ranked_defaults as (
  select
    id,
    row_number() over (
      partition by agency_id, product
      order by created_at desc, id desc
    ) as default_rank
  from public.account_template_grants
  where is_default = true
)
update public.account_template_grants grants
set is_default = false
from ranked_defaults
where grants.id = ranked_defaults.id
  and ranked_defaults.default_rank > 1;

create unique index if not exists account_template_grants_one_default_idx
  on public.account_template_grants (agency_id, product)
  where is_default = true;

drop trigger if exists agency_groups_set_updated_at
  on public.agency_groups;
create trigger agency_groups_set_updated_at
before update on public.agency_groups
for each row execute function public.set_updated_at();

drop trigger if exists agency_group_product_settings_set_updated_at
  on public.agency_group_product_settings;
create trigger agency_group_product_settings_set_updated_at
before update on public.agency_group_product_settings
for each row execute function public.set_updated_at();

drop trigger if exists agency_product_settings_set_updated_at
  on public.agency_product_settings;
create trigger agency_product_settings_set_updated_at
before update on public.agency_product_settings
for each row execute function public.set_updated_at();

create or replace function public.is_agency_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_group_members
    where agency_group_id = target_group_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_agency_group_admin(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_group_members
    where agency_group_id = target_group_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_agency_group_agency_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agencies a
    join public.agency_members m on m.agency_id = a.id
    where a.agency_group_id = target_group_id
      and m.user_id = auth.uid()
  );
$$;

alter table public.agency_groups enable row level security;
alter table public.agency_group_members enable row level security;
alter table public.agency_group_template_grants enable row level security;
alter table public.agency_group_product_settings enable row level security;
alter table public.agency_product_settings enable row level security;

create policy "Group and office members can view agency groups"
  on public.agency_groups
  for select
  using (
    public.is_agency_group_member(id)
    or public.is_agency_group_agency_member(id)
  );

create policy "Group admins can update agency groups"
  on public.agency_groups
  for update
  using (public.is_agency_group_admin(id));

create policy "Group members can view group memberships"
  on public.agency_group_members
  for select
  using (public.is_agency_group_member(agency_group_id));

create policy "Group and office members can read group template grants"
  on public.agency_group_template_grants
  for select
  using (
    public.is_agency_group_member(agency_group_id)
    or public.is_agency_group_agency_member(agency_group_id)
  );

create policy "Group and office members can read group product settings"
  on public.agency_group_product_settings
  for select
  using (
    public.is_agency_group_member(agency_group_id)
    or public.is_agency_group_agency_member(agency_group_id)
  );

create policy "Agency members can read agency product settings"
  on public.agency_product_settings
  for select
  using (public.is_agency_member(agency_id));

comment on table public.agency_groups is
  'Optional parent brand/group for multiple agency office workspaces.';
comment on table public.agency_group_members is
  'Group-level identities for future cross-office administration; office access remains controlled by agency_members.';
comment on table public.agency_group_template_grants is
  'Templates inherited by every agency office attached to the group.';
comment on table public.agency_group_product_settings is
  'Group-level template catalogue policy inherited by agency offices.';
comment on table public.agency_product_settings is
  'Office-level template catalogue policy; overrides the parent group when present.';
