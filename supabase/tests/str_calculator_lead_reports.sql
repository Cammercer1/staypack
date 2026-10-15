-- Run against a disposable database after the STR workspace/calculator migrations.
-- Uses only the synthetic agencies/users from str_workspace_fixture.sql; rolls back.
begin;
insert into public.str_calculator_widgets(id,agency_id,enabled) values
  ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',true);
set local role service_role;
do $$
declare
  v_agency uuid := '20000000-0000-4000-8000-000000000001';
  v_user uuid := '10000000-0000-4000-8000-000000000001';
  v_lead uuid;
  v_raw jsonb;
  v_draft jsonb;
  v_result jsonb;
  v_retry jsonb;
  v_saved public.reports%rowtype;
  v_original_report jsonb;
  v_original_listing jsonb;
  v_edited jsonb;
  v_listing_count integer;
  v_report_count integer;
  v_fetched timestamptz := now()-interval '14 days';
begin
  select to_jsonb(r) into v_original_report from public.reports r where id='40000000-0000-4000-8000-000000000001';
  select to_jsonb(l) into v_original_listing from public.listings l where id='30000000-0000-4000-8000-000000000001';
  select count(*) into v_listing_count from public.listings;
  select count(*) into v_report_count from public.reports;
  v_raw := jsonb_build_object('provider','airroi','input',jsonb_build_object('currency','AUD','latitude',-33.9,'longitude',151.2,'bedrooms',3,'bathrooms',1.5,'accommodates',6,'radiusM',2000),'response',jsonb_build_object('revenue',60000),'fetched_at',v_fetched);
  insert into public.str_calculator_leads(agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,country,input_json,original_estimate_json,estimate_json,status,consent_version,consent_text,completed_at)
    values(v_agency,'50000000-0000-4000-8000-000000000001',gen_random_uuid(),'hash','client','24 Beach Road, Bondi NSW 2026, Australia',3,'test@example.com','AU','{"bathrooms":1.5}',v_raw,'{"annualRevenue":60000}','estimated','v1','Consent',now()) returning id into v_lead;
  v_draft := jsonb_build_object('source_address','24 Beach Road, Bondi NSW 2026, Australia',
    'property',jsonb_build_object('property_address','24 Beach Road','suburb','Bondi','state','NSW','postcode','2026','country','Australia','bedrooms',3,'bathrooms',1.5,'accommodates',6,'latitude',-33.9,'longitude',151.2),
    'original_estimate',jsonb_build_object('annualRevenue',60000,'raw',v_raw),'final_estimate',jsonb_build_object('annualRevenue',66000,'raw',v_raw),
    'enrichment',jsonb_build_object('provider','airroi','fetched_at',v_fetched,'cost_cents',20),
    'overrides',jsonb_build_object('estimateInputs',jsonb_build_object('bedrooms',3,'bathrooms',1.5,'accommodates',6)),'fetched_at',v_fetched);

  begin
    perform public.create_str_calculator_lead_report(v_agency,v_lead,'10000000-0000-4000-8000-000000000002','classic-detailed',v_draft);
    raise exception 'Accepted another agency member';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_str_calculator_lead_report(v_agency,v_lead,null,'classic-detailed',v_draft);
    raise exception 'Accepted a missing caller';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_str_calculator_lead_report('20000000-0000-4000-8000-000000000002',v_lead,'10000000-0000-4000-8000-000000000002','classic-detailed',v_draft);
    raise exception 'Accepted another agency lead';
  exception when sqlstate 'PT404' then null; end;
  begin
    perform public.create_str_calculator_lead_report(v_agency,v_lead,v_user,'classic-detailed',jsonb_set(v_draft,'{source_address}','"Another property"'));
    raise sqlstate 'XX000' using message='Accepted changed source provenance';
  exception when raise_exception then null; end;
  begin
    perform public.create_str_calculator_lead_report(v_agency,v_lead,v_user,'classic-detailed',jsonb_set(v_draft,'{property,property_address}','"2/24 Beach Road"'));
    raise sqlstate 'XX000' using message='Accepted a different apartment';
  exception when raise_exception then null; end;

  v_result := public.create_str_calculator_lead_report(v_agency,v_lead,v_user,'classic-detailed',v_draft);
  assert v_result->>'created'='true' and v_result->>'estimate_reused'='true', 'Fresh provider snapshot must be reused';
  select * into v_saved from public.reports where id=(v_result->>'report_id')::uuid;
  assert v_saved.id <> '40000000-0000-4000-8000-000000000001' and v_saved.listing_id <> '30000000-0000-4000-8000-000000000001', 'Must create an isolated new property/report';
  assert v_saved.created_by=v_user and v_saved.status='estimated', 'Draft ownership/status missing';
  assert exists(select 1 from public.listings where id=v_saved.listing_id and public_slug ~ '^[0-9a-f]{32}$'), 'New property needs its own collision-resistant public slug';
  assert exists(select 1 from public.listings where id=v_saved.listing_id and property_address='24 Beach Road' and suburb='Bondi' and state='NSW' and postcode='2026'), 'Structured AU locality missing';
  assert v_saved.final_report_json is null and v_saved.pdf_url is null, 'Must not publish or generate a document';
  assert v_saved.original_estimate_json->>'annualRevenue'='60000' and v_saved.final_estimate_json->>'annualRevenue'='66000', 'Baseline and agency scenario must stay separate';
  assert (v_saved.str_enrichment_json->>'fetched_at')::timestamptz=v_fetched and v_saved.str_enrichment_json->>'cost_cents'='0', 'Reuse must retain precise provenance and incur no provider cost';
  assert exists(select 1 from public.str_appraisals where report_id=v_saved.id and agency_id=v_agency), 'New draft must open in the existing STR editor';
  assert (select report_id=v_saved.id from public.str_calculator_leads where id=v_lead), 'Lead must link the draft';
  assert (select count(*)=v_listing_count+1 from public.listings) and (select count(*)=v_report_count+1 from public.reports), 'Only one property/report created';

  update public.reports set final_estimate_json='{"annualRevenue":77777}', final_report_json='{"version":"standard_2_page_v1","edited":true}',status='published',pdf_url='https://example.com/saved.pdf' where id=v_saved.id;
  select to_jsonb(r) into v_edited from public.reports r where id=v_saved.id;
  v_retry := public.create_str_calculator_lead_report(v_agency,v_lead,v_user,null,null);
  assert v_retry->>'report_id'=v_result->>'report_id' and v_retry->>'created'='false', 'Replay must return the same report';
  assert (select to_jsonb(r)=v_edited from public.reports r where id=v_saved.id), 'Replay must not overwrite any edits or publication';
  assert (select count(*)=v_listing_count+1 from public.listings), 'Replay must not create another property';
  assert (select count(*)=count(distinct (agency_id,public_slug)) from public.listings), 'Draft slugs must be unique within an agency';
  assert (select to_jsonb(r)=v_original_report from public.reports r where id='40000000-0000-4000-8000-000000000001'), 'Existing report changed';
  assert (select to_jsonb(l)=v_original_listing from public.listings l where id='30000000-0000-4000-8000-000000000001'), 'Existing property changed';

  -- Recent enquiries must not extend expired provider data. The SQL boundary
  -- rejects a stale seed even if an application caller submits one accidentally.
  v_raw := jsonb_set(v_raw,'{fetched_at}',to_jsonb(now()-interval '720 hours'));
  insert into public.str_calculator_leads(agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,country,input_json,original_estimate_json,estimate_json,status,consent_version,consent_text,completed_at)
    values(v_agency,'50000000-0000-4000-8000-000000000001',gen_random_uuid(),'hash2','client2','24 Beach Road, Bondi NSW 2026, Australia',3,'test2@example.com','AU','{"bathrooms":1.5}',v_raw,'{"annualRevenue":60000}','estimated','v1','Consent',now()) returning id into v_lead;
  v_draft := jsonb_set(v_draft,'{original_estimate,raw}',v_raw);
  v_draft := jsonb_set(v_draft,'{fetched_at}',v_raw->'fetched_at');
  v_result := public.create_str_calculator_lead_report(v_agency,v_lead,v_user,'classic-detailed',v_draft);
  assert v_result->>'estimate_reused'='false', 'Exactly 30 days must expire';
  select * into v_saved from public.reports where id=(v_result->>'report_id')::uuid;
  assert v_saved.status='draft' and v_saved.original_estimate_json is null and v_saved.final_estimate_json is null and v_saved.str_enrichment_json is null, 'Expired data must not seed a new report';

  v_raw := jsonb_set(v_raw,'{fetched_at}','"invalid-timestamp"'::jsonb);
  insert into public.str_calculator_leads(agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,country,input_json,original_estimate_json,estimate_json,status,consent_version,consent_text,completed_at)
    values(v_agency,'50000000-0000-4000-8000-000000000001',gen_random_uuid(),'hash3','client3','24 Beach Road, Bondi NSW 2026, Australia',3,'test3@example.com','AU','{"bathrooms":1.5}',v_raw,'{"annualRevenue":60000}','estimated','v1','Consent',now()) returning id into v_lead;
  v_draft := jsonb_set(v_draft,'{original_estimate,raw}',v_raw);
  v_draft := jsonb_set(v_draft,'{fetched_at}',v_raw->'fetched_at');
  v_result := public.create_str_calculator_lead_report(v_agency,v_lead,v_user,'classic-detailed',v_draft);
  assert v_result->>'estimate_reused'='false', 'Malformed provenance must not fall back to recent completion';
  select * into v_saved from public.reports where id=(v_result->>'report_id')::uuid;
  assert v_saved.original_estimate_json is null and v_saved.final_estimate_json is null, 'Malformed raw data must remain out of the new draft';
end $$;
do $$
declare
  v_agency uuid := '20000000-0000-4000-8000-000000000002';
  v_user uuid := '10000000-0000-4000-8000-000000000002';
  v_lead uuid;
  v_result jsonb;
  v_draft jsonb;
begin
  update public.agencies set country_code='US' where id=v_agency;
  insert into public.str_calculator_widgets(id,agency_id,country,enabled) values('50000000-0000-4000-8000-000000000002',v_agency,'US',true);
  insert into public.str_calculator_leads(agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,country,input_json,status,consent_version,consent_text)
    values(v_agency,'50000000-0000-4000-8000-000000000002',gen_random_uuid(),'us-hash','us-client','616 N Croft Ave, Apt 2, West Hollywood, CA 90048-1234, USA',3,'test@example.com','US','{"bathrooms":1.5}','failed','v1','Consent') returning id into v_lead;
  v_draft := jsonb_build_object('source_address','616 N Croft Ave, Apt 2, West Hollywood, CA 90048-1234, USA',
    'property',jsonb_build_object('property_address','616 N Croft Ave Apt 2','suburb','West Hollywood','state','CA','postcode','90048-1234','country','United States','bedrooms',3,'bathrooms',1.5,'accommodates',6));
  v_result := public.create_str_calculator_lead_report(v_agency,v_lead,v_user,'classic-detailed',v_draft);
  assert exists(select 1 from public.reports r join public.listings l on l.id=r.listing_id where r.id=(v_result->>'report_id')::uuid and l.property_address='616 N Croft Ave Apt 2' and l.suburb='West Hollywood' and l.state='CA' and l.postcode='90048-1234' and l.bedrooms=3 and l.bathrooms=1.5), 'US unit/direction/locality/manual inputs missing';

  -- Ambiguous free-form input remains intact and does not invent a locality.
  insert into public.str_calculator_leads(agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,country,input_json,status,consent_version,consent_text)
    values(v_agency,'50000000-0000-4000-8000-000000000002',gen_random_uuid(),'fallback-hash','us-client','616 N Croft Ave Apt 2',3,'test@example.com','US','{"bathrooms":1.5}','failed','v1','Consent') returning id into v_lead;
  v_draft := jsonb_build_object('source_address','616 N Croft Ave Apt 2',
    'property',jsonb_build_object('property_address','616 N Croft Ave Apt 2','country','United States','bedrooms',3,'bathrooms',1.5,'accommodates',6));
  v_result := public.create_str_calculator_lead_report(v_agency,v_lead,v_user,'classic-detailed',v_draft);
  assert exists(select 1 from public.reports r join public.listings l on l.id=r.listing_id where r.id=(v_result->>'report_id')::uuid and l.property_address='616 N Croft Ave Apt 2' and l.suburb is null and l.state is null and l.postcode is null), 'Ambiguous fallback was rewritten';
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin perform public.create_str_calculator_lead_report(null,null,null,null,null); raise exception 'Authenticated RPC allowed'; exception when insufficient_privilege then null; end;
  assert (select count(report_id)=0 from public.str_calculator_leads), 'Unrelated user can read report links';
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.create_str_calculator_lead_report(null,null,null,null,null); raise exception 'Anonymous RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
