-- Preserve the cost of market occupancy fetched while preparing a new lead draft.
-- The calculator baseline is reused for free. Only a numeric nonnegative market
-- cost contributes to the new draft total; keep all nested evidence untouched.
-- Linked reports return before this path and are never backfilled or rewritten.
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

  -- A separate property draft avoids changing data used by any existing report.
  -- Photos and customer name are completed in the ordinary appraisal editor.
  insert into public.listings(agency_id,created_by,status,property_address,suburb,state,postcode,country,bedrooms,bathrooms,accommodates,latitude,longitude,public_slug)
    values(p_agency_id,p_user_id,'active',v_property->>'property_address',v_property->>'suburb',v_property->>'state',v_property->>'postcode',v_property->>'country',v_lead.bedrooms,
      (v_property->>'bathrooms')::numeric,(v_property->>'accommodates')::numeric,
      (v_property->>'latitude')::numeric,(v_property->>'longitude')::numeric,replace(gen_random_uuid()::text,'-',''))
    returning id into v_listing_id;
  perform public.create_str_appraisal(p_agency_id,v_listing_id,v_report_id,p_template_id,'{"mode":"general"}'::jsonb,'manual');
  update public.reports set created_by=p_user_id,
    status=case when v_reuse then 'estimated' else 'draft' end,
    original_estimate_json=case when v_reuse then p_draft->'original_estimate' end,
    final_estimate_json=case when v_reuse then p_draft->'final_estimate' end,
    str_enrichment_json=case when v_reuse then (p_draft->'enrichment') || jsonb_build_object('fetched_at',v_fetched_at,'cost_cents',v_market_cost_cents,'cache_status','hit') end,
    user_overrides_json=case when v_reuse then p_draft->'overrides'
      else jsonb_build_object('estimateInputs',p_draft #> '{overrides,estimateInputs}') end
    where id=v_report_id and agency_id=p_agency_id;
  update public.str_calculator_leads set report_id=v_report_id where id=p_lead_id and agency_id=p_agency_id;
  return jsonb_build_object('report_id',v_report_id,'created',true,'estimate_reused',v_reuse);
end;
$$;
revoke all on function public.create_str_calculator_lead_report(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_str_calculator_lead_report(uuid,uuid,uuid,text,jsonb) to service_role;
