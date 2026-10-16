-- Contacts are saved people; calculator enquiries remain separate events.
-- No historical reports, recipients, leads, published versions or billing are backfilled.

-- Read-only activity derived from actual report/link state, never estimate status.
create function public.contact_report_activity(p_agency_id uuid,p_report_id uuid) returns text
language sql stable security invoker set search_path='' as $$
  select case when r.status='archived' then 'archived'
    when exists(select 1 from public.digital_proposal_links l where l.agency_id=p_agency_id and l.report_id=r.id and l.revoked_at is null) then 'published'
    when exists(select 1 from public.digital_proposal_links l where l.agency_id=p_agency_id and l.report_id=r.id) then 'unpublished'
    when r.status='published' then 'published' else 'draft' end
  from public.reports r where r.id=p_report_id and r.agency_id=p_agency_id
    and (current_user='service_role' or public.is_agency_member(p_agency_id));
$$;
revoke all on function public.contact_report_activity(uuid,uuid) from public,anon;
grant execute on function public.contact_report_activity(uuid,uuid) to authenticated,service_role;

create function public.list_calculator_enquiries(p_agency_id uuid,p_page integer default 1,p_page_size integer default 25) returns jsonb
language sql stable security invoker set search_path='' as $$
  with enquiries as (
    select id,address,bedrooms,full_name,contact_id,email,phone,country,status,estimate_json,created_at,report_id
    from public.str_calculator_leads where agency_id=p_agency_id
      and (current_user='service_role' or public.is_agency_member(p_agency_id))
  ), paged as (
    select * from enquiries order by created_at desc,id desc
    limit least(greatest(p_page_size,1),100) offset (greatest(p_page,1)-1)*least(greatest(p_page_size,1),100)
  ) select jsonb_build_object('leads',coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object(
      'report_activity',public.contact_report_activity(p_agency_id,p.report_id)) order by p.created_at desc,p.id desc)
    from paged p),'[]'::jsonb),'total',(select count(*) from enquiries));
$$;
revoke all on function public.list_calculator_enquiries(uuid,integer,integer) from public,anon;
grant execute on function public.list_calculator_enquiries(uuid,integer,integer) to authenticated,service_role;

-- Only link a new enquiry to an unambiguous, active, consistent existing person.
-- A public submission cannot create or update a directory contact.
create function public.match_calculator_enquiry_contact() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.contact_id is null and nullif(btrim(new.full_name),'') is not null then
    select c.id into new.contact_id from public.agency_contacts c
    where c.agency_id=new.agency_id and c.merged_into_contact_id is null and c.archived_at is null
      and lower(btrim(c.email))=lower(btrim(new.email))
      and lower(regexp_replace(btrim(c.name),'[[:space:]]+',' ','g'))=lower(regexp_replace(btrim(new.full_name),'[[:space:]]+',' ','g'))
      and (nullif(c.phone,'') is null or nullif(new.phone,'') is null
        or coalesce(c.phone_e164,public.normalize_client_phone(c.phone),regexp_replace(c.phone,'[^0-9+]','','g'))
          =coalesce(public.normalize_client_phone(new.phone,new.country),regexp_replace(new.phone,'[^0-9+]','','g')));
  end if;
  return new;
end; $$;
revoke all on function public.match_calculator_enquiry_contact() from public,anon,authenticated;
grant execute on function public.match_calculator_enquiry_contact() to service_role;
create trigger calculator_enquiry_contact before insert on public.str_calculator_leads
  for each row execute function public.match_calculator_enquiry_contact();

-- Saving is explicit, atomic and retry-safe. It creates no property/report, does
-- not edit the enquiry's submitted details and never changes a report recipient.
create function public.save_calculator_enquiry_contact(p_agency_id uuid,p_user_id uuid,p_lead_id uuid,p_recipient jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_lead public.str_calculator_leads; v_id uuid; v_contact public.agency_contacts;
begin
  if not exists(select 1 from public.agency_members where agency_id=p_agency_id and user_id=p_user_id) then
    raise sqlstate '42501' using message='Agency access required';
  end if;
  select * into v_lead from public.str_calculator_leads where agency_id=p_agency_id and id=p_lead_id for update;
  if not found then raise sqlstate 'PT404' using message='Calculator enquiry not found'; end if;
  if v_lead.contact_id is not null then
    select coalesce(merged_into_contact_id,id) into v_id from public.agency_contacts where agency_id=p_agency_id and id=v_lead.contact_id;
  else
    if p_recipient->>'mode' is distinct from 'named' then raise sqlstate '22023' using message='Choose or add a contact'; end if;
    v_id := public.resolve_agency_client(p_agency_id,p_recipient);
    update public.str_calculator_leads set contact_id=v_id where agency_id=p_agency_id and id=p_lead_id;
  end if;
  select * into v_contact from public.agency_contacts where agency_id=p_agency_id and id=v_id;
  if not found then raise sqlstate 'PT404' using message='Contact not found'; end if;
  return jsonb_build_object('contact',public.client_contact_json(v_contact));
end; $$;
revoke all on function public.save_calculator_enquiry_contact(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_calculator_enquiry_contact(uuid,uuid,uuid,jsonb) to service_role;

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
  v_saved_contact public.agency_contacts;
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
  if v_lead.contact_id is not null then
    select c.* into v_saved_contact from public.agency_contacts c
      join public.agency_contacts source on source.agency_id=c.agency_id and coalesce(source.merged_into_contact_id,source.id)=c.id
      where source.agency_id=p_agency_id and source.id=v_lead.contact_id;
    if v_saved_contact.id is not null and v_saved_contact.archived_at is null then
      v_contact := v_saved_contact.id;
      v_recipient := jsonb_build_object('mode','named','contact_id',v_contact,'name',v_saved_contact.name,
        'email',v_saved_contact.email,'phone',v_saved_contact.phone,'phone_e164',v_saved_contact.phone_e164);
    else
      v_pending := jsonb_build_object('name',v_lead.full_name,'email',v_lead.email,'phone',v_phone,'reason','identity_conflict');
    end if;
  elsif nullif(btrim(v_lead.full_name),'') is null then
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
  update public.str_calculator_leads set report_id=v_report_id,contact_id=coalesce(v_contact,contact_id) where id=p_lead_id and agency_id=p_agency_id;
  update public.str_appraisals set client_source_lead_id=p_lead_id,client_review_required=v_pending is not null,client_pending_json=v_pending
    where report_id=v_report_id and agency_id=p_agency_id;
  return jsonb_build_object('report_id',v_report_id,'created',true,'estimate_reused',v_reuse);
end;
$$;
revoke all on function public.create_str_calculator_lead_report(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_str_calculator_lead_report(uuid,uuid,uuid,text,jsonb) to service_role;

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
      select r.id,a.kind,public.contact_report_activity(p_agency_id,r.id) as status,
        l.property_address as address,r.created_at
      from public.str_appraisals a join public.reports r on r.id=a.report_id and r.agency_id=a.agency_id
        join public.listings l on l.id=r.listing_id and l.agency_id=a.agency_id
      where a.agency_id=p_agency_id and a.contact_id=any(v_ids) order by r.created_at desc,r.id limit 50
    ) s),'[]'::jsonb),
    'reportsTotal',(select count(*) from public.str_appraisals where agency_id=p_agency_id and contact_id=any(v_ids)),
    'reportCounts',(select jsonb_build_object(
      'draft',count(*) filter(where status in ('draft','unpublished')),
      'published',count(*) filter(where status='published'),
      'archived',count(*) filter(where status='archived')) from (
        select public.contact_report_activity(p_agency_id,report_id) as status from public.str_appraisals
        where agency_id=p_agency_id and contact_id=any(v_ids)
      ) activity),
    'leads',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id) from (
      select id,address,status,created_at,report_id,contact_id,public.contact_report_activity(p_agency_id,report_id) as report_activity from public.str_calculator_leads where agency_id=p_agency_id and contact_id=any(v_ids) order by created_at desc,id limit 50
    ) s),'[]'::jsonb),
    'leadsTotal',(select count(*) from public.str_calculator_leads where agency_id=p_agency_id and contact_id=any(v_ids)));
end; $$;
