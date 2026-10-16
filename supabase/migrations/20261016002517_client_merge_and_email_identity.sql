-- Phase 1: explicitly merge reviewed client duplicates without touching any report,
-- lead, publication or billing row. Apply the unique-email migration only after
-- reviewing and merging existing duplicate groups through the service-only RPC.
alter table public.agency_contacts
  add column merged_into_contact_id uuid,
  add column merged_at timestamptz,
  add constraint agency_contacts_merge_agency_fk foreign key(agency_id,merged_into_contact_id)
    references public.agency_contacts(agency_id,id),
  add constraint agency_contacts_merge_shape check (
    (merged_into_contact_id is null and merged_at is null)
    or (merged_into_contact_id is not null and merged_into_contact_id<>id and merged_at is not null and archived_at is not null)
  );
create index agency_contacts_merged_into_idx on public.agency_contacts(agency_id,merged_into_contact_id)
  where merged_into_contact_id is not null;

-- Browser roles retain their existing ordinary contact permissions, but cannot
-- forge merge metadata or change a retained alias. Aliases keep all original
-- personal details; the merge RPC can only move them to another canonical client.
create function public.protect_agency_client_merge() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.merged_into_contact_id is not null or new.merged_at is not null then
      raise sqlstate '42501' using message='Merge an existing client through the merge operation';
    end if;
    return new;
  end if;
  if old.merged_into_contact_id is not null or new.merged_into_contact_id is not null
    or new.merged_at is distinct from old.merged_at then
    if current_user<>'service_role' then
      raise sqlstate '42501' using message='Merged clients cannot be changed directly';
    end if;
    if new.merged_into_contact_id is null
      or (to_jsonb(new)-array['merged_into_contact_id','merged_at','archived_at','updated_at'])
        is distinct from (to_jsonb(old)-array['merged_into_contact_id','merged_at','archived_at','updated_at']) then
      raise sqlstate 'PT409' using message='Merged client details are retained and cannot be changed';
    end if;
    if not exists(select 1 from public.agency_contacts where id=new.merged_into_contact_id
      and agency_id=new.agency_id and id<>new.id and merged_into_contact_id is null and archived_at is null) then
      raise sqlstate 'PT409' using message='Choose an active canonical client in the same agency';
    end if;
  end if;
  return new;
end; $$;
create trigger agency_contacts_merge_guard before insert or update on public.agency_contacts
  for each row execute function public.protect_agency_client_merge();
revoke all on function public.protect_agency_client_merge() from public,anon,authenticated;

-- Friendly conflicts for normal writes; phase 2 adds a unique index as the
-- concurrency authority, including transactions with an older MVCC snapshot.
create or replace function public.prevent_duplicate_agency_client() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_email text := nullif(lower(btrim(new.email)),'');
begin
  if new.merged_into_contact_id is not null or v_email is null then return new; end if;
  if tg_op='UPDATE' and old.agency_id=new.agency_id and old.merged_into_contact_id is null
    and nullif(lower(btrim(old.email)),'') is not distinct from v_email then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('client:' || new.agency_id::text || ':' || v_email,0));
  if exists(select 1 from public.agency_contacts where agency_id=new.agency_id and id<>new.id
    and merged_into_contact_id is null and lower(btrim(email))=v_email) then
    raise sqlstate 'PT409' using message='A client with this email already exists. Select the existing client or restore them from archived clients.';
  end if;
  return new;
end; $$;
drop trigger agency_contacts_prevent_duplicate on public.agency_contacts;
create trigger agency_contacts_prevent_duplicate before insert or update of email,agency_id,archived_at,merged_into_contact_id on public.agency_contacts
  for each row execute function public.prevent_duplicate_agency_client();

-- Operational merge only: explicit IDs, exact email agreement and optimistic
-- concurrency are required. Nothing is inferred from a shared email alone.
create function public.merge_agency_clients(p_agency_id uuid,p_source_client_id uuid,p_target_client_id uuid,
  p_source_expected_updated_at timestamptz,p_target_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_source public.agency_contacts; v_target public.agency_contacts; v_email text;
begin
  if current_user<>'service_role' then raise sqlstate '42501' using message='Service access required'; end if;
  if p_source_client_id is null or p_target_client_id is null or p_source_client_id=p_target_client_id then
    raise sqlstate '22023' using message='Choose two different clients';
  end if;
  select * into v_source from public.agency_contacts where agency_id=p_agency_id and id=p_source_client_id;
  select * into v_target from public.agency_contacts where agency_id=p_agency_id and id=p_target_client_id;
  if v_source.id is null or v_target.id is null then raise sqlstate 'PT404' using message='Client not found'; end if;
  v_email := nullif(lower(btrim(v_source.email)),'');
  if v_email is null or v_email is distinct from nullif(lower(btrim(v_target.email)),'') then
    raise sqlstate 'PT409' using message='Only reviewed clients with the same email can be merged';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('client:' || p_agency_id::text || ':' || v_email,0));
  perform 1 from public.agency_contacts where agency_id=p_agency_id
    and (id in (p_source_client_id,p_target_client_id) or merged_into_contact_id=p_source_client_id)
    order by id for update;
  select * into v_source from public.agency_contacts where agency_id=p_agency_id and id=p_source_client_id;
  select * into v_target from public.agency_contacts where agency_id=p_agency_id and id=p_target_client_id;
  if v_source.id is null or v_target.id is null then raise sqlstate 'PT404' using message='Client not found'; end if;
  if v_target.merged_into_contact_id is not null or v_target.archived_at is not null then
    raise sqlstate 'PT409' using message='Choose an active canonical client';
  end if;
  if v_source.merged_into_contact_id=p_target_client_id then
    return jsonb_build_object('client',public.client_contact_json(v_target),'mergedClientId',v_source.id,'alreadyMerged',true);
  end if;
  if v_source.merged_into_contact_id is not null then raise sqlstate 'PT409' using message='This client has already been merged'; end if;
  if p_source_expected_updated_at is null or p_target_expected_updated_at is null
    or v_source.updated_at<>p_source_expected_updated_at or v_target.updated_at<>p_target_expected_updated_at
    or nullif(lower(btrim(v_source.email)),'') is distinct from v_email
    or nullif(lower(btrim(v_target.email)),'') is distinct from v_email then
    raise sqlstate 'PT409' using message='These clients changed. Reload before merging.';
  end if;
  -- Flatten previous aliases first, keeping resolution one hop and preventing
  -- cycles. No report foreign key, recipient snapshot, link or PDF is rewritten.
  update public.agency_contacts set merged_into_contact_id=p_target_client_id
    where agency_id=p_agency_id and merged_into_contact_id=p_source_client_id;
  update public.agency_contacts set merged_into_contact_id=p_target_client_id,merged_at=now(),archived_at=coalesce(archived_at,now())
    where agency_id=p_agency_id and id=p_source_client_id;
  return jsonb_build_object('client',public.client_contact_json(v_target),'mergedClientId',v_source.id,'alreadyMerged',false);
end; $$;
revoke all on function public.merge_agency_clients(uuid,uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.merge_agency_clients(uuid,uuid,uuid,timestamptz,timestamptz) to service_role;

create or replace function public.resolve_agency_client(p_agency_id uuid,p_recipient jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
  v_id uuid := nullif(p_recipient->>'contact_id','')::uuid;
  v_email text := nullif(lower(btrim(p_recipient->>'email')),'');
  v_name text := nullif(btrim(p_recipient->>'name'),'');
  v_count integer;
  v_client public.agency_contacts;
  v_phone text := coalesce(nullif(p_recipient->>'phone_e164',''),public.normalize_client_phone(p_recipient->>'phone'));
begin
  if current_user<>'service_role' and not public.is_agency_member(p_agency_id) then
    raise sqlstate '42501' using message='Agency access required';
  end if;
  if v_name is null then raise sqlstate '22023' using message='Client name is required'; end if;
  if v_id is not null then
    select coalesce(merged_into_contact_id,id) into v_id from public.agency_contacts where id=v_id and agency_id=p_agency_id;
    if not exists(select 1 from public.agency_contacts where id=v_id and agency_id=p_agency_id and archived_at is null and merged_into_contact_id is null) then
      raise sqlstate 'PT404' using message='Choose an active client in your agency';
    end if;
    return v_id;
  end if;
  if v_email is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('client:' || p_agency_id::text || ':' || v_email,0));
    select count(*) into v_count from public.agency_contacts where agency_id=p_agency_id and merged_into_contact_id is null and lower(btrim(email))=v_email;
    if v_count>1 then raise sqlstate 'PT409' using message='More than one client uses this email. Select the correct client.'; end if;
    if v_count=1 then
      select * into v_client from public.agency_contacts where agency_id=p_agency_id and merged_into_contact_id is null and lower(btrim(email))=v_email;
      if v_client.archived_at is not null then raise sqlstate 'PT409' using message='This client is archived. Restore the client before selecting them.'; end if;
      if lower(regexp_replace(btrim(v_client.name),'[[:space:]]+',' ','g')) is distinct from lower(regexp_replace(v_name,'[[:space:]]+',' ','g'))
        or (nullif(v_client.phone,'') is not null and nullif(p_recipient->>'phone','') is not null
          and coalesce(v_client.phone_e164,public.normalize_client_phone(v_client.phone),regexp_replace(v_client.phone,'[^0-9+]','','g'))
            is distinct from coalesce(v_phone,regexp_replace(p_recipient->>'phone','[^0-9+]','','g'))) then
        raise sqlstate 'PT409' using message='This email matches different client details. Select the correct client before continuing.';
      end if;
      return v_client.id;
    end if;
  end if;
  insert into public.agency_contacts(agency_id,name,email,phone,phone_e164,created_by)
    values(p_agency_id,v_name,v_email,nullif(btrim(p_recipient->>'phone'),''),v_phone,auth.uid()) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.save_agency_client(p_agency_id uuid,p_client_id uuid,p_client jsonb,p_archived boolean,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_client public.agency_contacts; v_email text := nullif(lower(btrim(p_client->>'email')),'');
begin
  if current_user<>'service_role' and not public.is_agency_member(p_agency_id) then raise sqlstate '42501' using message='Agency access required'; end if;
  if nullif(btrim(p_client->>'name'),'') is null then raise sqlstate '22023' using message='Client name is required'; end if;
  if p_client_id is null then
    if v_email is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('client:' || p_agency_id::text || ':' || v_email,0));
      if exists(select 1 from public.agency_contacts where agency_id=p_agency_id and merged_into_contact_id is null and lower(btrim(email))=v_email) then
        raise sqlstate 'PT409' using message='A client with this email already exists. Select the existing client or restore them from archived clients.';
      end if;
    end if;
    insert into public.agency_contacts(agency_id,name,email,phone,phone_e164,created_by)
      values(p_agency_id,btrim(p_client->>'name'),v_email,nullif(btrim(p_client->>'phone'),''),public.normalize_client_phone(p_client->>'phone'),auth.uid()) returning * into v_client;
  else
    select * into v_client from public.agency_contacts where agency_id=p_agency_id and id=p_client_id for update;
    if not found then raise sqlstate 'PT404' using message='Client not found'; end if;
    if v_client.merged_into_contact_id is not null then raise sqlstate 'PT409' using message='This client was merged. Open the current client before editing.'; end if;
    if p_expected_updated_at is null or v_client.updated_at<>p_expected_updated_at then
      raise sqlstate 'PT409' using message='This client changed in another session. Reload before saving.';
    end if;
    update public.agency_contacts set name=btrim(p_client->>'name'),email=v_email,phone=nullif(btrim(p_client->>'phone'),''),
      phone_e164=public.normalize_client_phone(p_client->>'phone'),archived_at=case when p_archived then coalesce(archived_at,now()) end
      where agency_id=p_agency_id and id=p_client_id returning * into v_client;
  end if;
  return public.client_contact_json(v_client);
end; $$;

create or replace function public.list_agency_clients(p_agency_id uuid,p_search text default '',p_archived text default 'active',p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security invoker set search_path='' as $$
  with filtered as (
    select c.* from public.agency_contacts c where agency_id=p_agency_id and merged_into_contact_id is null
      and (current_user='service_role' or public.is_agency_member(p_agency_id))
      and (p_archived='all' or (p_archived='archived' and archived_at is not null) or (p_archived='active' and archived_at is null))
      and (coalesce(btrim(p_search),'')=''
        or position(lower(btrim(p_search)) in lower(c.name || ' ' || coalesce(c.email,'') || ' ' || coalesce(c.phone,'')))>0
        or (length(regexp_replace(p_search,'[^0-9]','','g'))>=3 and position(regexp_replace(p_search,'[^0-9]','','g') in regexp_replace(coalesce(c.phone_e164,c.phone,''),'[^0-9]','','g'))>0)
        or (public.normalize_client_phone(p_search) is not null and public.normalize_client_phone(p_search)
          =coalesce(c.phone_e164,public.normalize_client_phone(c.phone))))
  ), paged as (
    select * from filtered order by lower(name),id limit least(greatest(p_page_size,1),100)
      offset (greatest(p_page,1)-1)*least(greatest(p_page_size,1),100)
  ) select jsonb_build_object('clients',coalesce((select jsonb_agg(public.client_contact_json(p::public.agency_contacts) order by lower(name),id) from paged p),'[]'::jsonb),'total',(select count(*) from filtered));
$$;

create or replace function public.get_agency_client(p_agency_id uuid,p_client_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_client public.agency_contacts; v_canonical_id uuid; v_ids uuid[];
begin
  if current_user<>'service_role' and not public.is_agency_member(p_agency_id) then raise sqlstate '42501' using message='Agency access required'; end if;
  select coalesce(merged_into_contact_id,id) into v_canonical_id from public.agency_contacts where agency_id=p_agency_id and id=p_client_id;
  select * into v_client from public.agency_contacts where agency_id=p_agency_id and id=v_canonical_id;
  if not found then raise sqlstate 'PT404' using message='Client not found'; end if;
  select array_agg(id) into v_ids from public.agency_contacts where agency_id=p_agency_id and (id=v_canonical_id or merged_into_contact_id=v_canonical_id);
  return jsonb_build_object('client',public.client_contact_json(v_client),
    'reports',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id) from (
      select r.id,a.kind,case when r.status='archived' then 'archived' when exists(select 1 from public.digital_proposal_links link where link.report_id=r.id and link.agency_id=p_agency_id and link.revoked_at is null) then 'published' else r.status end as status,
        l.property_address as address,r.created_at
      from public.str_appraisals a join public.reports r on r.id=a.report_id and r.agency_id=a.agency_id
        join public.listings l on l.id=r.listing_id and l.agency_id=a.agency_id
      where a.agency_id=p_agency_id and a.contact_id=any(v_ids) order by r.created_at desc,r.id limit 50
    ) s),'[]'::jsonb),
    'reportsTotal',(select count(*) from public.str_appraisals where agency_id=p_agency_id and contact_id=any(v_ids)),
    'leads',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id) from (
      select id,address,status,created_at,report_id from public.str_calculator_leads where agency_id=p_agency_id and contact_id=any(v_ids) order by created_at desc,id limit 50
    ) s),'[]'::jsonb),
    'leadsTotal',(select count(*) from public.str_calculator_leads where agency_id=p_agency_id and contact_id=any(v_ids)));
end; $$;
