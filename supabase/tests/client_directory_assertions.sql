-- Run only after client_directory_run.py provisions the disposable fixtures.
begin;
do $$ begin
  assert (select jsonb_agg(to_jsonb(r) order by id) from public.reports r)=(select reports from public.client_qa_baseline), 'Migration changed an existing report';
  assert (select jsonb_agg(to_jsonb(v) order by id) from public.digital_proposal_versions v)=(select versions from public.client_qa_baseline), 'Migration changed a published version';
  assert (select jsonb_agg(to_jsonb(c) order by id) from public.agency_contacts c)=(select clients from public.client_qa_baseline), 'Migration rewrote legacy clients';
  assert not has_function_privilege('anon','public.list_agency_clients(uuid,text,text,integer,integer)','execute');
  assert not has_function_privilege('anon','public.save_agency_client(uuid,uuid,jsonb,boolean,timestamptz)','execute');
  assert not has_function_privilege('authenticated','public.create_str_calculator_lead_report(uuid,uuid,uuid,text,jsonb)','execute');
  assert not has_schema_privilege('authenticated','client_private','usage');
  assert not has_table_privilege('anon','public.agency_contacts','select');
  assert not has_column_privilege('anon','public.str_calculator_leads','full_name','select');
  assert not has_column_privilege('authenticated','public.str_calculator_leads','input_json','select');
end $$;
insert into public.str_calculator_widgets(id,agency_id,public_token,enabled,ask_phone) values
  ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',true,true);
set local role service_role;
do $$
declare
  agency uuid := '20000000-0000-4000-8000-000000000001';
  actor uuid := '10000000-0000-4000-8000-000000000001';
  draft jsonb := '{"source_address":"2/24 Cliffbrook Parade, Coogee NSW 2034","property":{"property_address":"2/24 Cliffbrook Parade, Coogee NSW 2034","country":"Australia","bedrooms":2,"bathrooms":1,"accommodates":4},"overrides":{"estimateInputs":{"bedrooms":2,"bathrooms":1,"accommodates":4}}}';
  input jsonb := '{"full_name":"Jordan Taylor","address":"2/24 Cliffbrook Parade, Coogee NSW 2034","bedrooms":2,"bathrooms":1,"country":"AU","email":"jordan@example.test","phone":"0400 000 001","consent":true}';
  reserved jsonb; result jsonb; history jsonb; saved jsonb; client jsonb; other uuid;
  lead uuid; report uuid; contact uuid; appraisal public.str_appraisals;
begin
  reserved := public.reserve_str_calculator_lead('51000000-0000-4000-8000-000000000001',gen_random_uuid(),'input','device',input,'v3','Consent');
  lead := (reserved->>'id')::uuid;
  assert (select full_name='Jordan Taylor' and phone='0400 000 001' from public.str_calculator_leads where id=lead), 'Reserve lost full name or optional phone';
  result := public.create_str_calculator_lead_report(agency,lead,actor,'classic-detailed',draft);
  report := (result->>'report_id')::uuid;
  select * into appraisal from public.str_appraisals where report_id=report;
  contact := appraisal.contact_id;
  assert contact is not null and appraisal.recipient_mode='named' and appraisal.recipient_name='Jordan Taylor', 'Lead client not attached';
  assert appraisal.recipient_email='jordan@example.test' and appraisal.recipient_phone_e164='+61400000001', 'Lead private contact lost';
  assert appraisal.client_source_lead_id=lead and not appraisal.client_review_required, 'Provenance/review state missing';
  assert (select contact_id=contact from public.str_calculator_leads where id=lead), 'Lead client link missing';
  assert (select phone='+61400000001' from public.agency_contacts where id=contact), 'Calculator client phone was not canonicalized';
  assert (public.list_agency_clients(agency,'0400000001')->>'total')='1', 'Full local phone did not find calculator client stored in international format';
  assert (public.list_agency_clients(agency,'0400 000 001')->>'total')='1', 'Formatted local phone did not find calculator client stored in international format';
  assert (public.list_agency_clients(agency,'+61 400 000 001')->>'total')='1', 'Formatted international phone search failed';
  saved := to_jsonb(appraisal);
  perform public.create_str_calculator_lead_report(agency,lead,actor,null,null);
  assert (select to_jsonb(a)=saved from public.str_appraisals a where report_id=report), 'Retry changed client snapshot';

  -- The same client creates new reports of any kind without new directory rows.
  perform public.create_appraisal(agency,'30000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','lease','standard-lease-appraisal',
    '{"mode":"named","name":"Jordan Taylor","email":"JORDAN@example.test","phone":"+61400000001","phone_e164":"+61400000001"}','{"version":1,"listing":{}}');
  perform public.create_appraisal(agency,'30000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000002','sales','standard-sales-appraisal',
    jsonb_build_object('mode','named','contact_id',contact,'name','Jordan Taylor','email','jordan@example.test'),' {"version":1,"listing":{}}');
  assert (select count(*)=1 from public.agency_contacts where agency_id=agency and lower(email)='jordan@example.test'), 'Creating another report duplicated client';
  history := public.get_agency_client(agency,contact);
  assert history->>'reportsTotal'='3' and history->>'leadsTotal'='1', 'Missing linked client history';
  assert not (history->'client' ? 'agency_id') and not (history->'client' ? 'created_by'), 'Directory response unexpectedly exposes internal fields';

  client := public.save_agency_client(agency,contact,'{"name":"Jordan Changed","email":"jordan@example.test","phone":"0400 000 001"}',false,appraisal.updated_at);
  assert (select to_jsonb(a)=saved from public.str_appraisals a where report_id=report), 'Directory edit rewrote report client snapshot';
  assert (select final_report_json is null from public.reports where id=report), 'Directory edit changed report document';
  begin
    perform public.save_agency_client(agency,contact,'{"name":"stale"}',false,(client->>'updated_at')::timestamptz-interval '1 second');
    raise exception 'Accepted stale directory edit';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.save_agency_client(agency,null,'{"name":"Duplicate","email":" JORDAN@example.test "}',false,null);
    raise exception 'Accepted duplicate directory email';
  exception when sqlstate 'PT409' then null; end;
  begin
    insert into public.agency_contacts(agency_id,name,email) values(agency,'Direct duplicate','jordan@example.test');
    raise exception 'Direct write bypassed duplicate protection';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.resolve_agency_client(agency,'{"name":"Jordan Changed","email":"jordan@example.test","phone":"0400 000 002"}');
    raise exception 'Conflicting phone number automatically linked a client';
  exception when sqlstate 'PT409' then null; end;
  assert (public.list_agency_clients(agency,'jordan@example.test')->>'total')='1', 'Email search failed';
  assert (public.list_agency_clients(agency,'0400 000 001')->>'total')='1', 'Phone search failed';
  assert (public.list_agency_clients(agency,'61400000001')->>'total')='1', 'Normalized phone search failed';
  assert (public.list_agency_clients(agency,'%')->>'total')='0', 'Search interpreted wildcard';
  history := public.list_agency_clients(agency,'','active',1,1);
  assert jsonb_array_length(history->'clients')=1 and history->>'total'='3', 'Pagination count is inaccurate';

  -- Public details cannot overwrite an existing directory client. Conflicts are
  -- preserved privately for explicit selection, and cannot be published silently.
  reserved := public.reserve_str_calculator_lead('51000000-0000-4000-8000-000000000001',gen_random_uuid(),'input2','device2',input || '{"full_name":"Someone Else"}','v3','Consent');
  lead := (reserved->>'id')::uuid;
  result := public.create_str_calculator_lead_report(agency,lead,actor,'classic-detailed',draft);
  select * into appraisal from public.str_appraisals where report_id=(result->>'report_id')::uuid;
  assert appraisal.client_review_required and appraisal.recipient_mode='general' and appraisal.recipient_email is null, 'Conflicting lead did not require review';
  assert appraisal.client_pending_json->>'name'='Someone Else' and appraisal.client_pending_json->>'email'='jordan@example.test', 'Conflict details were discarded';
  assert (select name='Jordan Changed' from public.agency_contacts where id=contact), 'Public lead overwrote directory name';
  begin
    insert into public.digital_proposal_versions(report_id,agency_id,draft_revision,share_token,final_report_json)
      values(appraisal.report_id,agency,1,repeat('b',64),'{}');
    raise exception 'Published without required client review';
  exception when sqlstate 'PT409' then null; end;
  appraisal := public.save_str_appraisal_recipient(agency,appraisal.report_id,jsonb_build_object('mode','named','contact_id',contact,'name','Jordan Report Name','email','private@example.test'),appraisal.updated_at);
  assert not appraisal.client_review_required and appraisal.client_pending_json is null, 'Explicit review did not clear pending state';
  assert (select contact_id=contact from public.str_calculator_leads where id=lead), 'Reviewed lead not associated';
  assert (select name='Jordan Changed' and email='jordan@example.test' from public.agency_contacts where id=contact), 'Report-specific edit changed directory';

  -- An old nameless lead keeps private contact details, asks for a name once.
  reserved := public.reserve_str_calculator_lead('51000000-0000-4000-8000-000000000001',gen_random_uuid(),'input3','device3',(input-'full_name') || '{"email":"old@example.test"}','v2','Consent');
  lead := (reserved->>'id')::uuid;
  result := public.create_str_calculator_lead_report(agency,lead,actor,'classic-detailed',draft);
  select * into appraisal from public.str_appraisals where report_id=(result->>'report_id')::uuid;
  assert appraisal.client_review_required and appraisal.client_pending_json->>'reason'='missing_name', 'Nameless lead not flagged';
  assert appraisal.client_pending_json->>'email'='old@example.test' and appraisal.client_pending_json->>'phone'='+61400000001', 'Legacy contact details lost';
  assert not exists(select 1 from public.agency_contacts where email='old@example.test'), 'Nameless lead invented a client name';
  -- General is an intentional choice, not a public submission's default.
  appraisal := public.save_str_appraisal_recipient(agency,appraisal.report_id,'{"mode":"general"}',appraisal.updated_at);
  assert not appraisal.client_review_required and appraisal.client_pending_json is null and appraisal.contact_id is null, 'Explicit general recipient choice did not save';

  -- Existing duplicate email records remain separate and require selection.
  reserved := public.reserve_str_calculator_lead('51000000-0000-4000-8000-000000000001',gen_random_uuid(),'input4','device4',input || '{"full_name":"Legacy One","email":"legacy-duplicate@example.test"}','v3','Consent');
  result := public.create_str_calculator_lead_report(agency,(reserved->>'id')::uuid,actor,'classic-detailed',draft);
  assert (select client_review_required from public.str_appraisals where report_id=(result->>'report_id')::uuid), 'Ambiguous email selected a client arbitrarily';
  assert (select count(*)=2 from public.agency_contacts where lower(email)='legacy-duplicate@example.test'), 'Ambiguous clients merged or duplicated';

  client := public.save_agency_client(agency,contact,'{"name":"Jordan Changed","email":"jordan@example.test","phone":"0400 000 001"}',true,(client->>'updated_at')::timestamptz);
  assert (public.list_agency_clients(agency,'jordan@example.test')->>'total')='0', 'Archived client still selectable';
  assert (public.list_agency_clients(agency,'jordan@example.test','archived')->>'total')='1', 'Archived client cannot be found';
  begin
    perform public.resolve_agency_client(agency,jsonb_build_object('contact_id',contact,'name','Jordan Changed'));
    raise exception 'Selected archived client';
  exception when sqlstate 'PT404' then null; end;
  assert (select to_jsonb(a)=saved from public.str_appraisals a where report_id=report), 'Archiving client changed existing report';

  -- Account-controlled optional phone is still stripped before storage.
  update public.str_calculator_widgets set ask_phone=false where agency_id=agency;
  reserved := public.reserve_str_calculator_lead('51000000-0000-4000-8000-000000000001',gen_random_uuid(),'input5','device5',input || '{"email":"no-phone@example.test"}','v3','Consent');
  assert (select phone is null and not(input_json ? 'phone') and full_name='Jordan Taylor' from public.str_calculator_leads where id=(reserved->>'id')::uuid), 'Disabled phone setting was bypassed';
  assert (select jsonb_agg(to_jsonb(v) order by id) from public.digital_proposal_versions v)=(select versions from public.client_qa_baseline), 'Existing publication changed';
end $$;

-- Browser role isolation, including the private trigger on explicit review.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ declare c jsonb; begin
  assert (select count(*)=0 from public.agency_contacts), 'RLS exposed another agency';
  assert (public.list_agency_clients('20000000-0000-4000-8000-000000000001')->>'total')='0', 'Search exposed another agency';
  begin
    perform public.get_agency_client('20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001');
    raise exception 'Detail exposed another agency';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_agency_client('20000000-0000-4000-8000-000000000001',null,'{"name":"Intruder"}',false,null);
    raise exception 'Wrote another agency';
  exception when insufficient_privilege then null; end;
  c := public.save_agency_client('20000000-0000-4000-8000-000000000002',null,'{"name":"Separate Client","email":"legacy-duplicate@example.test"}',false,null);
  assert c->>'name'='Separate Client', 'Email identity crossed agency boundary';
  begin
    perform public.resolve_agency_client('20000000-0000-4000-8000-000000000002','{"name":"Wrong account","contact_id":"70000000-0000-4000-8000-000000000001"}');
    raise exception 'Selected cross-agency client';
  exception when sqlstate 'PT404' then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare a public.str_appraisals; begin
  select * into a from public.str_appraisals where client_review_required limit 1;
  a := public.save_str_appraisal_recipient(a.agency_id,a.report_id,'{"mode":"named","name":"Verified client","email":"verified@example.test"}',a.updated_at);
  assert not a.client_review_required and a.contact_id is not null, 'Member review failed';
  assert (select contact_id=a.contact_id from public.str_calculator_leads where id=a.client_source_lead_id), 'Private trigger failed for member';
end $$;
rollback;
