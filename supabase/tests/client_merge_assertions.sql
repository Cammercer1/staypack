begin;
do $$ begin
 assert not has_function_privilege('anon','public.merge_agency_clients(uuid,uuid,uuid,timestamptz,timestamptz)','execute');
 assert not has_function_privilege('authenticated','public.merge_agency_clients(uuid,uuid,uuid,timestamptz,timestamptz)','execute');
 assert has_function_privilege('service_role','public.merge_agency_clients(uuid,uuid,uuid,timestamptz,timestamptz)','execute');
 assert not (select prosecdef from pg_proc where oid='public.merge_agency_clients(uuid,uuid,uuid,timestamptz,timestamptz)'::regprocedure), 'Merge unexpectedly bypasses RLS';
 assert (select indisunique and indisvalid from pg_index where indexrelid='public.agency_contacts_agency_normalized_email_key'::regclass), 'Missing authoritative uniqueness index';
 assert (select jsonb_agg(to_jsonb(r) order by id) from public.reports r)=(select reports from public.client_merge_qa_baseline), 'Merge changed existing reports';
 assert (select jsonb_agg(to_jsonb(a) order by report_id) from public.str_appraisals a)=(select appraisals from public.client_merge_qa_baseline), 'Merge changed appraisal recipient/pointer/timestamp';
 assert (select jsonb_agg(to_jsonb(l) order by id) from public.str_calculator_leads l)=(select leads from public.client_merge_qa_baseline), 'Merge changed leads';
 assert (select jsonb_agg(to_jsonb(v) order by id) from public.digital_proposal_versions v)=(select versions from public.client_merge_qa_baseline), 'Merge changed publication snapshots or PDFs';
 assert (select jsonb_agg(to_jsonb(l) order by id) from public.digital_proposal_links l) is not distinct from (select links from public.client_merge_qa_baseline), 'Merge changed public links';
 assert (select jsonb_agg(to_jsonb(l) order by id) from public.listings l)=(select listings from public.client_merge_qa_baseline), 'Merge changed properties';
end $$;
set local role service_role;
do $$
declare agency uuid := '20000000-0000-4000-8000-000000000001'; canonical uuid := '70000000-0000-4000-8000-000000000001';
 alias uuid := '70000000-0000-4000-8000-000000000002'; history jsonb; c jsonb; other uuid; lead_id uuid; v_report_id uuid; result jsonb;
begin
 assert (public.list_agency_clients(agency,'legacy-duplicate@example.test','all')->>'total')='1', 'Aliases leak into all client search';
 assert (public.list_agency_clients(agency,'legacy-duplicate@example.test','active')->>'total')='1', 'Canonical missing from active search';
 assert (public.list_agency_clients(agency,'legacy-duplicate@example.test','archived')->>'total')='0', 'Aliases masquerade as archived clients';
 assert public.resolve_agency_client(agency,'{"name":"Legacy One","email":"  LEGACY-DUPLICATE@EXAMPLE.TEST "}')=canonical, 'Email did not reuse canonical client';
 assert public.resolve_agency_client(agency,jsonb_build_object('name','Report recipient','contact_id',alias))=canonical, 'Old picker selection did not resolve canonical client';
 history := public.get_agency_client(agency,alias);
 assert history #>> '{client,id}'=canonical::text and history->>'reportsTotal'='2' and history->>'leadsTotal'='1', 'Merged history incomplete';
 assert not exists(select 1 from public.agency_contacts where merged_into_contact_id is not null and archived_at is null), 'Alias not retired';
 begin
  perform public.save_agency_client(agency,alias,'{"name":"New name","email":"free@example.test"}',false,(select updated_at from public.agency_contacts where id=alias));
  raise exception 'Restored or edited merged alias';
 exception when sqlstate 'PT409' then null; end;
 begin
  update public.agency_contacts set email='free@example.test' where id=alias;
  raise exception 'Direct service edit changed retained alias';
 exception when sqlstate 'PT409' then null; end;
 begin
  update public.agency_contacts set merged_into_contact_id=null,merged_at=null,archived_at=null where id=alias;
  raise exception 'Reanimated merged alias';
 exception when sqlstate 'PT409' then null; end;
 begin
  perform public.save_agency_client(agency,null,'{"name":"Duplicate","email":" LEGACY-DUPLICATE@example.test "}',false,null);
  raise exception 'Created duplicate after merge';
 exception when sqlstate 'PT409' then null; end;
 begin
  insert into public.agency_contacts(agency_id,name,email,archived_at) values(agency,'Archived duplicate','legacy-duplicate@example.test',now());
  raise exception 'Direct archive bypassed duplicate prevention';
 exception when sqlstate 'PT409' then null; end;
 c := public.save_agency_client(agency,canonical,'{"name":"Legacy One","email":"legacy-duplicate@example.test"}',true,(select updated_at from public.agency_contacts where id=canonical));
 begin
  insert into public.agency_contacts(agency_id,name,email) values(agency,'New active duplicate',' LEGACY-DUPLICATE@EXAMPLE.TEST ');
  raise exception 'Created active copy of archived canonical';
 exception when sqlstate 'PT409' then null; end;
 begin
  perform public.resolve_agency_client(agency,jsonb_build_object('name','Report recipient','contact_id',alias));
  raise exception 'Old alias selected archived canonical';
 exception when sqlstate 'PT404' then null; end;
 c := public.save_agency_client(agency,canonical,'{"name":"Legacy One","email":"legacy-duplicate@example.test"}',false,(c->>'updated_at')::timestamptz);
 c := public.save_agency_client(agency,null,'{"name":"Other Person","email":"other@example.test"}',false,null);
 other := (c->>'id')::uuid;
 begin
  perform public.merge_agency_clients(agency,other,canonical,(c->>'updated_at')::timestamptz,(select updated_at from public.agency_contacts where id=canonical));
  raise exception 'Merged different emails without review';
 exception when sqlstate 'PT409' then null; end;
 begin
  perform public.merge_agency_clients(agency,canonical,canonical,now(),now());
  raise exception 'Self merge accepted';
 exception when sqlstate '22023' then null; end;
 begin
  perform public.merge_agency_clients(agency,canonical,alias,now(),now());
  raise exception 'Merge cycle accepted';
 exception when sqlstate 'PT409' then null; end;
 -- New calculator enquiries and each appraisal kind resolve through the same
 -- canonical identity, while existing saved report recipients stay untouched.
 insert into public.str_calculator_leads(agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,full_name,country,input_json,consent_version,consent_text)
  values(agency,'75000000-0000-4000-8000-000000000001',gen_random_uuid(),'new-lead','client','24 Beach Road, Sydney NSW 2000',2,' LEGACY-DUPLICATE@example.test ','Legacy One','AU','{}','v3','Consent') returning id into lead_id;
 result := public.create_str_calculator_lead_report(agency,lead_id,'10000000-0000-4000-8000-000000000001','classic-detailed',
  '{"source_address":"24 Beach Road, Sydney NSW 2000","property":{"property_address":"24 Beach Road, Sydney NSW 2000","bedrooms":2,"bathrooms":1,"accommodates":4,"country":"Australia"}}');
 v_report_id := (result->>'report_id')::uuid;
 assert (select a.contact_id=canonical and not a.client_review_required and a.recipient_name='Legacy One' from public.str_appraisals a where a.report_id=v_report_id), 'New calculator lead did not automatically reuse merged client';
 perform public.create_appraisal(agency,'30000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001','lease','standard-lease-appraisal',
  jsonb_build_object('mode','named','contact_id',alias,'name','Original Lease Recipient'),' {"version":1,"listing":{}}');
 perform public.create_appraisal(agency,'30000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000002','sales','standard-sales-appraisal',
  '{"mode":"named","name":"Legacy One","email":"legacy-duplicate@example.test"}',' {"version":1,"listing":{}}');
 assert (select count(*)=3 from public.str_appraisals a where a.report_id in(v_report_id,'77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000002') and a.contact_id=canonical), 'An appraisal kind bypassed canonical client resolution';
 assert (select count(*)=1 from public.agency_contacts where agency_id=agency and lower(btrim(email))='legacy-duplicate@example.test' and merged_into_contact_id is null), 'New report duplicated merged client';
 -- Empty emails are intentionally not identities; unrelated names can coexist.
 insert into public.agency_contacts(agency_id,name,email) values(agency,'No email 1',null),(agency,'No email 2',' '),(agency,'No email 3',null);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
declare agency uuid := '20000000-0000-4000-8000-000000000001'; canonical uuid := '70000000-0000-4000-8000-000000000001'; alias uuid := '70000000-0000-4000-8000-000000000002';
begin
 assert public.resolve_agency_client(agency,jsonb_build_object('name','Snapshot name','contact_id',alias))=canonical;
 begin
  update public.agency_contacts set merged_into_contact_id=alias,merged_at=now(),archived_at=now() where id=canonical;
  raise exception 'Browser forged merge metadata';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.agency_contacts(agency_id,name,email,merged_into_contact_id,merged_at,archived_at)
   values(agency,'Forged','forged@example.test',canonical,now(),now());
  raise exception 'Browser inserted forged alias';
 exception when insufficient_privilege then null; end;
 begin
  update public.agency_contacts set name='Changed alias' where id=alias;
  raise exception 'Browser edited alias';
 exception when insufficient_privilege then null; end;
 begin
  perform public.merge_agency_clients(agency,alias,canonical,now(),now());
  raise exception 'Browser called service merge RPC';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ declare c jsonb; begin
 assert (public.list_agency_clients('20000000-0000-4000-8000-000000000001')->>'total')='0';
 begin
  perform public.get_agency_client('20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002');
  raise exception 'Cross-agency alias disclosed history';
 exception when insufficient_privilege then null; end;
 c := public.save_agency_client('20000000-0000-4000-8000-000000000002',null,'{"name":"Independent Client","email":"legacy-duplicate@example.test"}',false,null);
 assert c->>'email'='legacy-duplicate@example.test', 'Uniqueness crossed agency boundary';
end $$;
set local role service_role;
do $$ begin
 begin
  perform public.merge_agency_clients('20000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001',now(),now());
  raise exception 'Cross-agency merge accepted';
 exception when sqlstate 'PT404' then null; end;
end $$;
rollback;
