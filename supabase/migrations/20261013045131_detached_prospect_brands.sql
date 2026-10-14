-- Internal sales material is independent of customer agencies and memberships.
create table public.prospect_operators (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.prospect_operators enable row level security;
revoke all on public.prospect_operators from public, anon, authenticated;
grant select on public.prospect_operators to authenticated;
grant all on public.prospect_operators to service_role;
create policy prospect_operator_self on public.prospect_operators for select to authenticated
  using (user_id = (select auth.uid()));

create table public.prospect_brands (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.prospect_operators(user_id),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 120),
  profile_json jsonb not null check (jsonb_typeof(profile_json) = 'object'),
  converted_agency_id uuid unique references public.agencies(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, slug), unique(id, owner_user_id)
);
alter table public.prospect_brands enable row level security;
revoke all on public.prospect_brands from public, anon, authenticated;
grant select on public.prospect_brands to authenticated;
grant all on public.prospect_brands to service_role;
create policy prospect_brand_owner on public.prospect_brands for select to authenticated
  using (owner_user_id = (select auth.uid()) and exists (
    select 1 from public.prospect_operators where user_id = (select auth.uid())
  ));

create table public.prospect_proposals (
  id uuid primary key,
  brand_id uuid not null,
  owner_user_id uuid not null,
  property_address text not null,
  -- Originals, explicit assumptions and the frozen presentation stay separate.
  source_listing_json jsonb not null,
  original_estimate_json jsonb not null,
  enrichment_json jsonb not null,
  overrides_json jsonb not null,
  brand_snapshot_json jsonb not null,
  final_report_json jsonb not null,
  public_token text unique check(public_token ~ '^[a-f0-9]{64}$'),
  published_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(brand_id, owner_user_id) references public.prospect_brands(id, owner_user_id),
  check ((public_token is null) = (published_at is null))
);
create index prospect_proposals_brand on public.prospect_proposals(brand_id, created_at desc);
create index prospect_proposals_owner on public.prospect_proposals(owner_user_id, created_at desc);
alter table public.prospect_proposals enable row level security;
revoke all on public.prospect_proposals from public, anon, authenticated;
grant select on public.prospect_proposals to authenticated;
grant all on public.prospect_proposals to service_role;
create policy prospect_proposal_owner on public.prospect_proposals for select to authenticated
  using (owner_user_id = (select auth.uid()) and exists (
    select 1 from public.prospect_operators where user_id = (select auth.uid())
  ));

-- Adoption is an explicit onboarding operation after an agency has signed up.
-- No Auth user, agency, membership or billing record is created here.
create function public.attach_prospect_brand(p_brand_id uuid, p_agency_id uuid, p_owner_id uuid,
  p_agency_brand jsonb, p_presets jsonb, p_assignment jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_brand public.prospect_brands;
begin
  select * into v_brand from public.prospect_brands
    where id=p_brand_id and owner_user_id=p_owner_id for update;
  if not found or not exists(select 1 from public.prospect_operators where user_id=p_owner_id) then
    raise exception 'Prospect not found' using errcode='PT404';
  end if;
  if v_brand.converted_agency_id is not null then
    if v_brand.converted_agency_id=p_agency_id then return; end if;
    raise exception 'Brand is already attached to an account' using errcode='PT409';
  end if;
  perform id from public.agencies where id=p_agency_id for update;
  if not found or not exists(select 1 from public.agency_members where agency_id=p_agency_id) then
    raise exception 'Create the customer account before attaching branding' using errcode='PT409';
  end if;
  if exists(select 1 from public.digital_proposal_assignments where agency_id=p_agency_id) then
    raise exception 'This account already has a proposal design; review it before replacing branding' using errcode='PT409';
  end if;
  update public.agencies set
    name=p_agency_brand->>'name', website_url=p_agency_brand->>'website_url',
    logo_url=p_agency_brand->>'logo_url', logo_dark_url=p_agency_brand->>'logo_dark_url',
    logo_light_url=p_agency_brand->>'logo_light_url', phone=p_agency_brand->>'phone', email=p_agency_brand->>'email',
    primary_colour=p_agency_brand->>'primary_colour', secondary_colour=p_agency_brand->>'secondary_colour',
    accent_colour=p_agency_brand->>'accent_colour', text_colour=p_agency_brand->>'text_colour',
    background_colour=p_agency_brand->>'background_colour',
    heading_font_family=p_agency_brand->>'heading_font_family', body_font_family=p_agency_brand->>'body_font_family',
    str_management_presets=p_presets, updated_at=now()
    where id=p_agency_id;
  insert into public.digital_proposal_assignments(agency_id,name,version,defaults)
    values(p_agency_id,p_assignment->>'name',(p_assignment->>'version')::integer,p_assignment->'defaults');
  update public.prospect_brands set converted_agency_id=p_agency_id,updated_at=now() where id=p_brand_id;
end; $$;
revoke all on function public.attach_prospect_brand(uuid,uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.attach_prospect_brand(uuid,uuid,uuid,jsonb,jsonb,jsonb) to service_role;
