-- Additive STR workspace. Public report payloads and existing IDs stay unchanged.
create unique index reports_agency_id_id_key on public.reports (agency_id, id);

create table public.agency_contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  email text check (length(email) <= 254),
  phone text check (length(phone) <= 50),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, id)
);
create index agency_contacts_name_idx on public.agency_contacts (agency_id, name) where archived_at is null;
create trigger agency_contacts_set_updated_at before update on public.agency_contacts
  for each row execute function public.set_updated_at();

create table public.str_appraisals (
  report_id uuid primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  contact_id uuid,
  recipient_mode text not null default 'general' check (recipient_mode in ('named', 'general')),
  recipient_name text check (length(recipient_name) <= 200),
  recipient_email text check (length(recipient_email) <= 254),
  recipient_phone text check (length(recipient_phone) <= 50),
  recipient_phone_e164 text check (recipient_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  source text not null default 'manual' check (source in ('manual', 'legacy', 'managed_delivery')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (agency_id, report_id) references public.reports(agency_id, id) on delete cascade,
  foreign key (agency_id, contact_id) references public.agency_contacts(agency_id, id),
  constraint str_recipient_shape check (
    (recipient_mode = 'named' and recipient_name is not null and length(btrim(recipient_name)) > 0)
    or (recipient_mode = 'general' and contact_id is null and recipient_name is null
      and recipient_email is null and recipient_phone is null and recipient_phone_e164 is null)
  )
);
create index str_appraisals_agency_idx on public.str_appraisals (agency_id, updated_at desc);
create index str_appraisals_contact_idx on public.str_appraisals (agency_id, contact_id);
create trigger str_appraisals_set_updated_at before update on public.str_appraisals
  for each row execute function public.set_updated_at();

alter table public.agency_contacts enable row level security;
alter table public.str_appraisals enable row level security;
revoke all on public.agency_contacts, public.str_appraisals from anon, authenticated;
grant select, insert, update on public.agency_contacts, public.str_appraisals to authenticated;
grant all on public.agency_contacts, public.str_appraisals to service_role;
create policy contacts_select on public.agency_contacts for select to authenticated
  using (public.is_agency_member(agency_id));
create policy contacts_insert on public.agency_contacts for insert to authenticated
  with check (public.is_agency_member(agency_id));
create policy contacts_update on public.agency_contacts for update to authenticated
  using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id));
create policy str_appraisals_select on public.str_appraisals for select to authenticated
  using (public.is_agency_member(agency_id));
create policy str_appraisals_insert on public.str_appraisals for insert to authenticated
  with check (public.is_agency_member(agency_id));
create policy str_appraisals_update on public.str_appraisals for update to authenticated
  using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id));

-- Positive classification only. Exclude contradictory sales/lease evidence.
insert into public.str_appraisals (report_id, agency_id, source, created_at, updated_at)
select r.id, r.agency_id, 'legacy', r.created_at, r.updated_at
from public.reports r
where r.listing_id is not null
  and coalesce(r.template_id, '') not like '%lease-appraisal%'
  and coalesce(r.template_id, '') not like '%sales-appraisal%'
  and coalesce(r.final_report_json->>'version', '') not in ('lease_appraisal_v1', 'sales_appraisal_v1')
  and not exists (select 1 from public.collateral_items c where c.report_id=r.id and c.type in ('lease_appraisal','sales_appraisal'))
  and (
    exists (select 1 from public.collateral_items c where c.report_id=r.id and c.type='str_report')
    or r.final_report_json->>'version' = 'standard_2_page_v1'
    or r.template_id like '%-str'
    or r.template_id in ('classic-detailed','bold-detailed','minimalist-detailed','gallery-detailed','editorial-detailed','landmark-detailed','refined-detailed','split-detailed')
  );

-- Stable property-level source for brochures, including legacy unlinked STRs.
insert into public.collateral_items (listing_id, agency_id, type, status, report_id)
select distinct on (r.listing_id) r.listing_id, r.agency_id, 'str_report',
  case when r.status in ('published','generated') then r.status else 'draft' end, r.id
from public.reports r join public.str_appraisals a on a.report_id=r.id
where r.status <> 'archived'
order by r.listing_id, r.created_at, r.id
on conflict (listing_id, type) do nothing;

-- Keep old application deployments and automated writers visible during rollout.
-- These invoker triggers only register positive STR evidence; they never edit
-- report payloads, existing customer details, or a property's brochure source.
create function public.register_str_report() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.listing_id is not null and (
    new.template_id like '%-str'
    or new.template_id in ('classic-detailed','bold-detailed','minimalist-detailed','gallery-detailed','editorial-detailed','landmark-detailed','refined-detailed','split-detailed')
    or new.final_report_json->>'version'='standard_2_page_v1'
  ) and coalesce(new.template_id,'') not like '%lease-appraisal%'
    and coalesce(new.template_id,'') not like '%sales-appraisal%'
    and coalesce(new.final_report_json->>'version','') not in ('lease_appraisal_v1','sales_appraisal_v1') then
    insert into public.str_appraisals(report_id,agency_id,source,created_at,updated_at)
    values(new.id,new.agency_id,'legacy',new.created_at,new.updated_at) on conflict(report_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger reports_register_str after insert or update of template_id,final_report_json on public.reports
  for each row execute function public.register_str_report();

create function public.register_str_collateral() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.type='str_report' and new.report_id is not null then
    insert into public.str_appraisals(report_id,agency_id,source,created_at,updated_at)
    select id,agency_id,'legacy',created_at,updated_at from public.reports
    where id=new.report_id and agency_id=new.agency_id and listing_id=new.listing_id
      and coalesce(template_id,'') not like '%lease-appraisal%'
      and coalesce(template_id,'') not like '%sales-appraisal%'
      and coalesce(final_report_json->>'version','') not in ('lease_appraisal_v1','sales_appraisal_v1')
    on conflict(report_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger collateral_register_str after insert or update of report_id on public.collateral_items
  for each row execute function public.register_str_collateral();
revoke all on function public.register_str_report(),public.register_str_collateral() from public,anon,authenticated;

-- All writes use caller privileges and agency checks. No SECURITY DEFINER.
create function public.save_str_appraisal_recipient(
  p_agency_id uuid, p_report_id uuid, p_recipient jsonb, p_expected_updated_at timestamptz
) returns public.str_appraisals
language plpgsql security invoker set search_path = '' as $$
declare
  v_appraisal public.str_appraisals;
  v_contact uuid;
  v_mode text := p_recipient->>'mode';
begin
  if current_user <> 'service_role' and not public.is_agency_member(p_agency_id) then
    raise exception 'Agency access required' using errcode='42501';
  end if;
  select * into v_appraisal from public.str_appraisals
    where report_id=p_report_id and agency_id=p_agency_id for update;
  if not found then raise exception 'STR appraisal not found'; end if;
  if p_expected_updated_at is null or v_appraisal.updated_at <> p_expected_updated_at then
    raise exception 'Customer details changed in another session. Reload before saving.' using errcode='40001';
  end if;
  if exists (select 1 from public.reports where id=p_report_id and status='archived') then
    raise exception 'Restore this appraisal before editing its customer.';
  end if;
  if v_mode is null or v_mode not in ('named','general') then raise exception 'Invalid recipient mode'; end if;
  if v_mode='named' then
    if coalesce(length(btrim(p_recipient->>'name')),0)=0 then raise exception 'Customer name is required'; end if;
    v_contact := nullif(p_recipient->>'contact_id','')::uuid;
    if v_contact is not null then
      if not exists (select 1 from public.agency_contacts where id=v_contact and agency_id=p_agency_id and archived_at is null) then
        raise exception 'Customer not found in this agency';
      end if;
    else
      insert into public.agency_contacts (agency_id,name,email,phone,phone_e164,created_by)
      values (p_agency_id,btrim(p_recipient->>'name'),nullif(p_recipient->>'email',''),
        nullif(p_recipient->>'phone',''),nullif(p_recipient->>'phone_e164',''),auth.uid()) returning id into v_contact;
    end if;
  end if;
  update public.str_appraisals set contact_id=v_contact, recipient_mode=v_mode,
    recipient_name=case when v_mode='named' then btrim(p_recipient->>'name') end,
    recipient_email=case when v_mode='named' then nullif(p_recipient->>'email','') end,
    recipient_phone=case when v_mode='named' then nullif(p_recipient->>'phone','') end,
    recipient_phone_e164=case when v_mode='named' then nullif(p_recipient->>'phone_e164','') end
  where report_id=p_report_id and agency_id=p_agency_id returning * into v_appraisal;
  return v_appraisal;
end;
$$;

create function public.create_str_appraisal(
  p_agency_id uuid, p_listing_id uuid, p_report_id uuid, p_template_id text,
  p_recipient jsonb, p_source text default 'manual'
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_appraisal public.str_appraisals;
  v_existing_listing uuid;
begin
  if current_user <> 'service_role' and not public.is_agency_member(p_agency_id) then
    raise exception 'Agency access required' using errcode='42501';
  end if;
  if p_source not in ('manual','managed_delivery') then raise exception 'Invalid appraisal source'; end if;
  if not exists (select 1 from public.listings where id=p_listing_id and agency_id=p_agency_id and status<>'archived') then
    raise exception 'Choose an active property in your agency';
  end if;
  -- Serialize retries for this UUID before creating any contacts or reports.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_report_id::text,0));
  select a.* into v_appraisal from public.str_appraisals a where a.report_id=p_report_id and a.agency_id=p_agency_id;
  if found then
    select listing_id into v_existing_listing from public.reports where id=p_report_id and agency_id=p_agency_id;
    if v_existing_listing <> p_listing_id
      or v_appraisal.recipient_mode is distinct from p_recipient->>'mode'
      or (v_appraisal.recipient_mode='named' and (
        v_appraisal.recipient_name is distinct from btrim(p_recipient->>'name')
        or v_appraisal.recipient_email is distinct from nullif(p_recipient->>'email','')
        or v_appraisal.recipient_phone is distinct from nullif(p_recipient->>'phone','')))
    then raise exception 'This request already created an appraisal with different details. Open the saved appraisal before editing.'; end if;
    return p_report_id;
  end if;
  insert into public.reports (id,agency_id,listing_id,created_by,template_id,status)
    values (p_report_id,p_agency_id,p_listing_id,auth.uid(),p_template_id,'draft');
  insert into public.str_appraisals (report_id,agency_id,source)
    values (p_report_id,p_agency_id,p_source)
    on conflict(report_id) do update set source=excluded.source returning * into v_appraisal;
  perform public.save_str_appraisal_recipient(p_agency_id,p_report_id,p_recipient,v_appraisal.updated_at);
  insert into public.collateral_items (listing_id,agency_id,type,status,report_id)
    values (p_listing_id,p_agency_id,'str_report','draft',p_report_id)
    on conflict (listing_id,type) do nothing;
  return p_report_id;
end;
$$;

create function public.list_str_appraisals(
  p_agency_id uuid, p_search text default '', p_status text default 'all',
  p_listing_id uuid default null, p_page integer default 1, p_page_size integer default 20
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with scoped as (
    select a.*, r.status, r.updated_at as report_updated_at,
      greatest(a.updated_at,r.updated_at) as activity_at,
      jsonb_build_object('id',r.id,'listing_id',r.listing_id,'status',r.status,'updated_at',r.updated_at,'pdf_url',r.pdf_url,
        'listing',jsonb_build_object('id',l.id,'property_address',l.property_address,'hero_image_url',l.hero_image_url,'suburb',l.suburb,'status',l.status)) as report
    from public.str_appraisals a join public.reports r on r.id=a.report_id and r.agency_id=a.agency_id
    join public.listings l on l.id=r.listing_id and l.agency_id=a.agency_id
    where a.agency_id=p_agency_id and (p_listing_id is null or l.id=p_listing_id)
      and (coalesce(p_search,'')='' or position(lower(p_search) in lower(coalesce(a.recipient_name,'') || ' ' || coalesce(l.property_address,'') || ' ' || coalesce(l.suburb,'')))>0)
  ), filtered as (
    select * from scoped where
      (p_status='all' and status<>'archived') or (p_status='draft' and status in ('draft','scraped','estimated'))
      or (p_status='ready' and status='generated') or (p_status in ('published','failed','archived') and status=p_status)
  ), paged as (
    select * from filtered order by activity_at desc,report_id
    limit least(greatest(p_page_size,1),100) offset (greatest(p_page,1)-1)*least(greatest(p_page_size,1),100)
  ) select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(p)-'status'-'report_updated_at'-'activity_at' order by activity_at desc,report_id) from paged p),'[]'::jsonb),
    'total',(select count(*) from filtered),
    'counts',(select jsonb_build_object('draft',count(*) filter(where status in ('draft','scraped','estimated')),
      'ready',count(*) filter(where status='generated'),'published',count(*) filter(where status='published'),
      'failed',count(*) filter(where status='failed'),'archived',count(*) filter(where status='archived')) from scoped)
  );
$$;

revoke all on function public.create_str_appraisal(uuid,uuid,uuid,text,jsonb,text) from public,anon;
revoke all on function public.save_str_appraisal_recipient(uuid,uuid,jsonb,timestamptz) from public,anon;
revoke all on function public.list_str_appraisals(uuid,text,text,uuid,integer,integer) from public,anon;
grant execute on function public.create_str_appraisal(uuid,uuid,uuid,text,jsonb,text) to authenticated,service_role;
grant execute on function public.save_str_appraisal_recipient(uuid,uuid,jsonb,timestamptz) to authenticated,service_role;
grant execute on function public.list_str_appraisals(uuid,text,text,uuid,integer,integer) to authenticated,service_role;
