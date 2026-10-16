-- Private client directory and calculator-to-appraisal handoff. No existing report,
-- publication, contact or lead is backfilled; old published snapshots stay unchanged.
alter table public.str_calculator_leads
  add column full_name text check(full_name is null or length(btrim(full_name)) between 1 and 200),
  add column contact_id uuid,
  add constraint calculator_lead_client_agency_fk foreign key(agency_id,contact_id)
    references public.agency_contacts(agency_id,id),
  add constraint calculator_lead_agency_id_key unique(agency_id,id);
grant select(full_name,contact_id) on public.str_calculator_leads to authenticated;
create index calculator_leads_contact_idx on public.str_calculator_leads(agency_id,contact_id,created_at desc) where contact_id is not null;

alter table public.str_appraisals
  add column client_source_lead_id uuid,
  add column client_review_required boolean not null default false,
  add column client_pending_json jsonb check(client_pending_json is null or jsonb_typeof(client_pending_json)='object'),
  add constraint appraisal_client_source_agency_fk foreign key(agency_id,client_source_lead_id)
    references public.str_calculator_leads(agency_id,id) on delete set null(client_source_lead_id);
create index appraisals_client_source_idx on public.str_appraisals(agency_id,client_source_lead_id) where client_source_lead_id is not null;
-- SELECT * in a view is fixed at creation. Append the new private columns.
create or replace view public.appraisals with(security_invoker=true) as select * from public.str_appraisals;

create index agency_contacts_email_lookup on public.agency_contacts(agency_id,lower(btrim(email))) where email is not null;

create function public.client_contact_json(p_client public.agency_contacts) returns jsonb
language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('id',p_client.id,'name',p_client.name,'email',p_client.email,'phone',p_client.phone,
    'phone_e164',p_client.phone_e164,'archived_at',p_client.archived_at,'created_at',p_client.created_at,'updated_at',p_client.updated_at);
$$;
create function public.normalize_client_phone(p_phone text,p_country text default 'AU') returns text
language sql immutable security invoker set search_path='' as $$
  select case when value ~ '^\+[1-9][0-9]{7,14}$' then value
    when p_country='AU' and value ~ '^0[23478][0-9]{8}$' then '+61' || substr(value,2)
    when p_country='US' and value ~ '^[2-9][0-9]{9}$' then '+1' || value
    when p_country='US' and value ~ '^1[2-9][0-9]{9}$' then '+' || value end
  from (select regexp_replace(coalesce(p_phone,''),'[[:space:]().-]','','g') as value) s;
$$;

-- Existing duplicate records are left alone. Future inserts/email changes cannot
-- add another active match. Transaction locks also cover direct Data API writes.
create function public.prevent_duplicate_agency_client() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_email text := nullif(lower(btrim(new.email)),'');
begin
  if new.archived_at is not null or v_email is null then return new; end if;
  if tg_op='UPDATE' and old.agency_id=new.agency_id and old.archived_at is null
    and nullif(lower(btrim(old.email)),'') is not distinct from v_email then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('client:' || new.agency_id::text || ':' || v_email,0));
  if exists(select 1 from public.agency_contacts where agency_id=new.agency_id and id<>new.id
    and archived_at is null and lower(btrim(email))=v_email) then
    raise sqlstate 'PT409' using message='A client with this email already exists. Search for and select that client.';
  end if;
  return new;
end; $$;
create trigger agency_contacts_prevent_duplicate before insert or update of email,agency_id,archived_at on public.agency_contacts
  for each row execute function public.prevent_duplicate_agency_client();

-- Reuse only an explicit selection or one unambiguous, consistent email match.
-- Submitted details never update a matched client's master directory record.
create function public.resolve_agency_client(p_agency_id uuid,p_recipient jsonb) returns uuid
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
    if not exists(select 1 from public.agency_contacts where id=v_id and agency_id=p_agency_id and archived_at is null) then
      raise sqlstate 'PT404' using message='Choose an active client in your agency';
    end if;
    return v_id;
  end if;
  if v_email is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('client:' || p_agency_id::text || ':' || v_email,0));
    select count(*) into v_count from public.agency_contacts where agency_id=p_agency_id and lower(btrim(email))=v_email;
    if v_count>1 then raise sqlstate 'PT409' using message='More than one client uses this email. Select the correct client.'; end if;
    if v_count=1 then
      select * into v_client from public.agency_contacts where agency_id=p_agency_id and lower(btrim(email))=v_email;
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

create function public.save_agency_client(p_agency_id uuid,p_client_id uuid,p_client jsonb,p_archived boolean,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_client public.agency_contacts; v_email text := nullif(lower(btrim(p_client->>'email')),'');
begin
  if current_user<>'service_role' and not public.is_agency_member(p_agency_id) then raise sqlstate '42501' using message='Agency access required'; end if;
  if nullif(btrim(p_client->>'name'),'') is null then raise sqlstate '22023' using message='Client name is required'; end if;
  if p_client_id is null then
    if v_email is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('client:' || p_agency_id::text || ':' || v_email,0));
      if exists(select 1 from public.agency_contacts where agency_id=p_agency_id and lower(btrim(email))=v_email) then
        raise sqlstate 'PT409' using message='A client with this email already exists. Select the existing client or restore them from archived clients.';
      end if;
    end if;
    insert into public.agency_contacts(agency_id,name,email,phone,phone_e164,created_by)
      values(p_agency_id,btrim(p_client->>'name'),v_email,nullif(btrim(p_client->>'phone'),''),public.normalize_client_phone(p_client->>'phone'),auth.uid()) returning * into v_client;
  else
    select * into v_client from public.agency_contacts where agency_id=p_agency_id and id=p_client_id for update;
    if not found then raise sqlstate 'PT404' using message='Client not found'; end if;
    if p_expected_updated_at is null or v_client.updated_at<>p_expected_updated_at then
      raise sqlstate 'PT409' using message='This client changed in another session. Reload before saving.';
    end if;
    update public.agency_contacts set name=btrim(p_client->>'name'),email=v_email,phone=nullif(btrim(p_client->>'phone'),''),
      phone_e164=public.normalize_client_phone(p_client->>'phone'),archived_at=case when p_archived then coalesce(archived_at,now()) end
      where agency_id=p_agency_id and id=p_client_id returning * into v_client;
  end if;
  return public.client_contact_json(v_client);
end; $$;

create function public.list_agency_clients(p_agency_id uuid,p_search text default '',p_archived text default 'active',p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security invoker set search_path='' as $$
  with filtered as (
    select c.* from public.agency_contacts c where agency_id=p_agency_id
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

create function public.get_agency_client(p_agency_id uuid,p_client_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v_client public.agency_contacts;
begin
  if current_user<>'service_role' and not public.is_agency_member(p_agency_id) then raise sqlstate '42501' using message='Agency access required'; end if;
  select * into v_client from public.agency_contacts where agency_id=p_agency_id and id=p_client_id;
  if not found then raise sqlstate 'PT404' using message='Client not found'; end if;
  return jsonb_build_object('client',public.client_contact_json(v_client),
    'reports',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id) from (
      select r.id,a.kind,case when r.status='archived' then 'archived' when exists(select 1 from public.digital_proposal_links link where link.report_id=r.id and link.agency_id=p_agency_id and link.revoked_at is null) then 'published' else r.status end as status,
        l.property_address as address,r.created_at
      from public.str_appraisals a join public.reports r on r.id=a.report_id and r.agency_id=a.agency_id
        join public.listings l on l.id=r.listing_id and l.agency_id=a.agency_id
      where a.agency_id=p_agency_id and a.contact_id=p_client_id order by r.created_at desc,r.id limit 50
    ) s),'[]'::jsonb),
    'reportsTotal',(select count(*) from public.str_appraisals where agency_id=p_agency_id and contact_id=p_client_id),
    'leads',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id) from (
      select id,address,status,created_at,report_id from public.str_calculator_leads where agency_id=p_agency_id and contact_id=p_client_id order by created_at desc,id limit 50
    ) s),'[]'::jsonb),
    'leadsTotal',(select count(*) from public.str_calculator_leads where agency_id=p_agency_id and contact_id=p_client_id));
end; $$;

create or replace function public.save_str_appraisal_recipient(p_agency_id uuid,p_report_id uuid,p_recipient jsonb,p_expected_updated_at timestamptz)
returns public.str_appraisals language plpgsql security invoker set search_path='' as $$
declare v_appraisal public.str_appraisals; v_contact uuid; v_mode text := p_recipient->>'mode';
begin
  if current_user<>'service_role' and not public.is_agency_member(p_agency_id) then raise sqlstate '42501' using message='Agency access required'; end if;
  select * into v_appraisal from public.str_appraisals where report_id=p_report_id and agency_id=p_agency_id for update;
  if not found then raise sqlstate 'PT404' using message='Appraisal not found'; end if;
  if p_expected_updated_at is null or v_appraisal.updated_at<>p_expected_updated_at then raise sqlstate 'PT409' using message='Client details changed in another session. Reload before saving.'; end if;
  if exists(select 1 from public.reports where id=p_report_id and status='archived') then raise exception 'Restore this appraisal before editing its client.'; end if;
  if v_mode is null or v_mode not in ('named','general') then raise exception 'Invalid recipient mode'; end if;
  if v_mode='named' then v_contact := public.resolve_agency_client(p_agency_id,p_recipient); end if;
  update public.str_appraisals set contact_id=v_contact,recipient_mode=v_mode,
    recipient_name=case when v_mode='named' then btrim(p_recipient->>'name') end,
    recipient_email=case when v_mode='named' then nullif(p_recipient->>'email','') end,
    recipient_phone=case when v_mode='named' then nullif(p_recipient->>'phone','') end,
    recipient_phone_e164=case when v_mode='named' then nullif(p_recipient->>'phone_e164','') end,
    client_review_required=false,client_pending_json=null
    where report_id=p_report_id and agency_id=p_agency_id returning * into v_appraisal;
  -- The source lead is readable but not writable by browser roles. Its association
  -- is maintained by a tightly scoped trigger below; report snapshots stay separate.
  return v_appraisal;
end; $$;

-- Authenticated recipient saves need a narrow way to attach their source lead.
-- This trigger updates only the already-linked, same-agency lead. It cannot write
-- names, email, phones, estimate data or any other report.
create schema if not exists client_private;
revoke all on schema client_private from public,anon,authenticated;
create function client_private.sync_appraisal_client_lead() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is not null then
    if not exists(select 1 from public.agency_members where agency_id=new.agency_id and user_id=(select auth.uid())) then
      raise sqlstate '42501' using message='Agency access required';
    end if;
  elsif current_setting('role',true) is distinct from 'service_role' then
    raise sqlstate '42501' using message='Agency access required';
  end if;
  if new.client_source_lead_id is not null and not new.client_review_required then
    update public.str_calculator_leads set contact_id=new.contact_id
      where id=new.client_source_lead_id and agency_id=new.agency_id and report_id=new.report_id;
  end if;
  return new;
end; $$;
create trigger appraisal_client_lead after update of contact_id,client_review_required on public.str_appraisals
  for each row when(old.contact_id is distinct from new.contact_id or old.client_review_required is distinct from new.client_review_required)
  execute function client_private.sync_appraisal_client_lead();

-- Block only new publication inserts until a new lead's client has been reviewed.
-- Published versions are immutable and never revisited by this trigger.
create function public.require_reviewed_proposal_client() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.str_appraisals where report_id=new.report_id and agency_id=new.agency_id and client_review_required) then
    raise sqlstate 'PT409' using message='Review the client details before publishing this proposal.';
  end if;
  return new;
end; $$;
create trigger proposal_client_review before insert on public.digital_proposal_versions for each row execute function public.require_reviewed_proposal_client();

revoke all on function public.client_contact_json(public.agency_contacts),public.normalize_client_phone(text,text),
  public.resolve_agency_client(uuid,jsonb),public.save_agency_client(uuid,uuid,jsonb,boolean,timestamptz),
  public.list_agency_clients(uuid,text,text,integer,integer),public.get_agency_client(uuid,uuid) from public,anon;
grant execute on function public.client_contact_json(public.agency_contacts),public.normalize_client_phone(text,text),
  public.resolve_agency_client(uuid,jsonb),public.save_agency_client(uuid,uuid,jsonb,boolean,timestamptz),
  public.list_agency_clients(uuid,text,text,integer,integer),public.get_agency_client(uuid,uuid) to authenticated,service_role;
revoke all on function public.prevent_duplicate_agency_client(),client_private.sync_appraisal_client_lead(),public.require_reviewed_proposal_client() from public,anon,authenticated;

create or replace function public.reserve_str_calculator_lead(
  p_token uuid, p_request_id uuid, p_input_hash text, p_client_hash text,
  p_input jsonb, p_consent_version text, p_consent_text text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  w public.str_calculator_widgets%rowtype;
  l public.str_calculator_leads%rowtype;
begin
  select * into w from public.str_calculator_widgets where public_token=p_token for update;
  if not found or not w.enabled then raise sqlstate 'PT404' using message='Calculator unavailable'; end if;
  if p_input->>'country' is distinct from w.country then
    raise sqlstate 'PT409' using message='Calculator country changed';
  end if;
  select * into l from public.str_calculator_leads where widget_id=w.id and request_id=p_request_id;
  if found then
    if l.input_hash <> p_input_hash then raise sqlstate 'PT409' using message='Request already used'; end if;
    return jsonb_build_object('id',l.id,'fresh',false,'status',l.status,'estimate',l.estimate_json,'created_at',l.created_at);
  end if;
  if (select count(*) from public.str_calculator_leads where widget_id=w.id and created_at > now()-interval '24 hours') >= 100
    or (select count(*) from public.str_calculator_leads where widget_id=w.id and client_hash=p_client_hash and created_at > now()-interval '1 hour') >= 5 then
    raise sqlstate 'PT429' using message='Calculator request limit reached';
  end if;
  if p_input->>'consent' is distinct from 'true' then raise exception 'Consent is required'; end if;
  -- Re-check the saved setting under the widget lock before retaining contact data.
  if not w.ask_phone or nullif(btrim(p_input->>'phone'),'') is null then
    p_input := p_input - 'phone';
  else
    p_input := jsonb_set(p_input, '{phone}', to_jsonb(btrim(p_input->>'phone')));
  end if;
  insert into public.str_calculator_leads(agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,phone,full_name,country,input_json,consent_version,consent_text)
    values(w.agency_id,w.id,p_request_id,p_input_hash,p_client_hash,p_input->>'address',(p_input->>'bedrooms')::integer,
      p_input->>'email',p_input->>'phone',nullif(btrim(p_input->>'full_name'),''),w.country,p_input,p_consent_version,p_consent_text) returning * into l;
  return jsonb_build_object('id',l.id,'fresh',true,'status',l.status,'estimate',null,'created_at',l.created_at);
end;
$$;
revoke all on function public.reserve_str_calculator_lead(uuid,uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.reserve_str_calculator_lead(uuid,uuid,text,text,jsonb,text,text) to service_role;

create or replace function public.create_str_calculator_lead_report(
  p_agency_id uuid, p_lead_id uuid, p_user_id uuid, p_template_id text, p_draft jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_lead public.str_calculator_leads%rowtype;
  v_report public.reports%rowtype;
  v_listing_id uuid;
  v_report_id uuid := gen_random_uuid();
  v_property jsonb;
  v_source_address text;
  v_fetched_at timestamptz;
  v_reuse boolean := false;
  v_market_cost_cents numeric := 0;
  v_recipient jsonb := '{"mode":"general"}'::jsonb;
  v_contact uuid;
  v_pending jsonb;
  v_phone text;
begin
  if not exists (select 1 from public.agency_members where agency_id=p_agency_id and user_id=p_user_id) then
    raise sqlstate '42501' using message='Agency access required';
  end if;
  select * into v_lead from public.str_calculator_leads where id=p_lead_id and agency_id=p_agency_id for update;
  if not found then raise sqlstate 'PT404' using message='Calculator enquiry not found'; end if;
  if v_lead.report_id is not null then
    select * into v_report from public.reports where id=v_lead.report_id and agency_id=p_agency_id;
    if not found then raise sqlstate 'PT404' using message='Report not found'; end if;
    -- Do not reapply a template, seed, recipient or new agency defaults on replay.
    return jsonb_build_object('report_id',v_report.id,'created',false,'estimate_reused',v_report.original_estimate_json is not null);
  end if;
  if p_draft is null or p_template_id is null then raise exception 'Draft details are required'; end if;
  if not exists (select 1 from public.agencies where id=p_agency_id and coalesce(country_code,'AU')=v_lead.country) then
    raise exception 'The property country must match the agency country';
  end if;
  v_property := p_draft->'property';
  if p_draft->>'source_address' is distinct from v_lead.address
    or (v_property->>'bedrooms')::integer is distinct from v_lead.bedrooms
    or v_property->>'country' is distinct from (case when v_lead.country='US' then 'United States' else 'Australia' end) then
    raise exception 'Property details must match the enquiry';
  end if;
  -- A parsed street/locality must recompose to the original address. Only commas,
  -- spacing, letter case and an explicit country suffix may differ; never units.
  if v_property->>'property_address' is distinct from v_lead.address then
    v_source_address := regexp_replace(v_lead.address,
      case when v_lead.country='US' then ',[[:space:]]*(USA|US|United States( of America)?)[[:space:]]*$'
        else ',[[:space:]]*(Australia|AU)[[:space:]]*$' end,'','i');
    if nullif(btrim(v_property->>'property_address'),'') is null
      or nullif(btrim(v_property->>'suburb'),'') is null
      or nullif(btrim(v_property->>'state'),'') is null
      or nullif(btrim(v_property->>'postcode'),'') is null
      or lower(regexp_replace(btrim(v_source_address),'[[:space:],]+',' ','g')) is distinct from
        lower(regexp_replace(btrim(concat_ws(' ',v_property->>'property_address',v_property->>'suburb',v_property->>'state',v_property->>'postcode')),'[[:space:],]+',' ','g')) then
      raise exception 'Property details must match the enquiry';
    end if;
  end if;
  -- The original provider timestamp is authoritative. A new enquiry completion
  -- timestamp must never extend the life of data obtained from the shared cache.
  begin
    v_fetched_at := case when v_lead.original_estimate_json ? 'fetched_at'
      then (v_lead.original_estimate_json->>'fetched_at')::timestamptz else v_lead.completed_at end;
    v_reuse := coalesce(v_lead.status='estimated'
      and v_lead.original_estimate_json->>'provider'='airroi'
      and v_fetched_at <= now() and v_fetched_at > now()-interval '720 hours'
      and (p_draft->>'fetched_at')::timestamptz=v_fetched_at
      and jsonb_typeof(p_draft->'original_estimate')='object'
      and jsonb_typeof(p_draft->'final_estimate')='object'
      and jsonb_typeof(p_draft->'enrichment')='object'
      and p_draft #> '{original_estimate,raw,response}' = v_lead.original_estimate_json->'response'
      and p_draft #> '{original_estimate,raw,input}' = v_lead.original_estimate_json->'input',false);
  exception when invalid_datetime_format or datetime_field_overflow then
    v_reuse := false;
  end;

  if v_reuse and jsonb_typeof(p_draft #> '{enrichment,market_occupancy,cost_cents}')='number' then
    v_market_cost_cents := greatest(0,(p_draft #>> '{enrichment,market_occupancy,cost_cents}')::numeric);
  end if;

  -- Resolve only after the existing-report early return. Incomplete or conflicting
  -- legacy leads keep their private details and require explicit client review.
  v_phone := coalesce(public.normalize_client_phone(v_lead.phone,v_lead.country),v_lead.phone);
  if nullif(btrim(v_lead.full_name),'') is null then
    v_pending := jsonb_build_object('name',null,'email',v_lead.email,'phone',v_phone,'reason','missing_name');
  else
    v_recipient := jsonb_build_object('mode','named','name',v_lead.full_name,'email',v_lead.email,'phone',v_phone,
      'phone_e164',public.normalize_client_phone(v_phone,v_lead.country));
    begin
      v_contact := public.resolve_agency_client(p_agency_id,v_recipient);
      v_recipient := v_recipient || jsonb_build_object('contact_id',v_contact);
    exception when sqlstate 'PT409' then
      v_pending := jsonb_build_object('name',v_lead.full_name,'email',v_lead.email,'phone',v_phone,'reason','identity_conflict');
      v_recipient := '{"mode":"general"}'::jsonb;
    end;
  end if;

  -- A separate property draft avoids changing data used by any existing report.
  insert into public.listings(agency_id,created_by,status,property_address,suburb,state,postcode,country,bedrooms,bathrooms,accommodates,latitude,longitude,public_slug)
    values(p_agency_id,p_user_id,'active',v_property->>'property_address',v_property->>'suburb',v_property->>'state',v_property->>'postcode',v_property->>'country',v_lead.bedrooms,
      (v_property->>'bathrooms')::numeric,(v_property->>'accommodates')::numeric,
      (v_property->>'latitude')::numeric,(v_property->>'longitude')::numeric,replace(gen_random_uuid()::text,'-',''))
    returning id into v_listing_id;
  perform public.create_str_appraisal(p_agency_id,v_listing_id,v_report_id,p_template_id,v_recipient,'manual');
  update public.reports set created_by=p_user_id,
    status=case when v_reuse then 'estimated' else 'draft' end,
    original_estimate_json=case when v_reuse then p_draft->'original_estimate' end,
    final_estimate_json=case when v_reuse then p_draft->'final_estimate' end,
    str_enrichment_json=case when v_reuse then (p_draft->'enrichment') || jsonb_build_object('fetched_at',v_fetched_at,'cost_cents',v_market_cost_cents,'cache_status','hit') end,
    user_overrides_json=case when v_reuse then p_draft->'overrides'
      else jsonb_build_object('estimateInputs',p_draft #> '{overrides,estimateInputs}') end
    where id=v_report_id and agency_id=p_agency_id;
  update public.str_calculator_leads set report_id=v_report_id,contact_id=v_contact where id=p_lead_id and agency_id=p_agency_id;
  update public.str_appraisals set client_source_lead_id=p_lead_id,client_review_required=v_pending is not null,client_pending_json=v_pending
    where report_id=v_report_id and agency_id=p_agency_id;
  return jsonb_build_object('report_id',v_report_id,'created',true,'estimate_reused',v_reuse);
end;
$$;
revoke all on function public.create_str_calculator_lead_report(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_str_calculator_lead_report(uuid,uuid,uuid,text,jsonb) to service_role;
