-- Disposable client_directory_qa only. Every synthetic change is rolled back.
begin;
create temp table contact_history_baseline as select id,to_jsonb(r) as snapshot from public.reports r;
create temp table contact_versions_baseline as select id,to_jsonb(v) as snapshot from public.digital_proposal_versions v;
grant select on contact_history_baseline,contact_versions_baseline to service_role;
insert into public.str_calculator_widgets(id,agency_id,public_token,enabled,ask_phone) values
 ('81000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002',true,true) on conflict(agency_id) do update set enabled=true,ask_phone=true;
set local role service_role;
do $$
declare
 agency uuid := '20000000-0000-4000-8000-000000000001';
 actor uuid := '10000000-0000-4000-8000-000000000001';
 token uuid := '81000000-0000-4000-8000-000000000002';
 input jsonb := '{"address":"2/24 Cliffbrook Parade, Coogee NSW 2034","bedrooms":2,"country":"AU","full_name":"New Person","email":"new-person@example.test","phone":"0400 000 001","consent":true}';
 draft jsonb := '{"source_address":"2/24 Cliffbrook Parade, Coogee NSW 2034","property":{"property_address":"2/24 Cliffbrook Parade, Coogee NSW 2034","country":"Australia","bedrooms":2,"bathrooms":1,"accommodates":4}}';
 lead uuid; matching_lead uuid; conflict_lead uuid; saved uuid; report uuid; other uuid;
 before_count bigint; before_report bigint; result jsonb; original jsonb; contact_snapshot jsonb; history jsonb;
begin
 select public_token into token from public.str_calculator_widgets where agency_id=agency;
 assert not has_function_privilege('anon','public.list_calculator_enquiries(uuid,integer,integer)','execute');
 assert not has_function_privilege('authenticated','public.save_calculator_enquiry_contact(uuid,uuid,uuid,jsonb)','execute');
 assert not has_function_privilege('anon','public.contact_report_activity(uuid,uuid)','execute');
 select count(*) into before_count from public.agency_contacts;
 select count(*) into before_report from public.reports;
 lead := (public.reserve_str_calculator_lead(token,gen_random_uuid(),'input','device',input,'v3','Consent')->>'id')::uuid;
 assert (select contact_id is null and report_id is null from public.str_calculator_leads where id=lead), 'Raw enquiry was converted';
 assert (select count(*) from public.agency_contacts)=before_count, 'Public calculator created a contact';
 select to_jsonb(l)-'contact_id' into original from public.str_calculator_leads l where id=lead;
 result := public.save_calculator_enquiry_contact(agency,actor,lead,'{"mode":"named","name":"Corrected Person","email":"new-person@example.test","phone":"+61400000001"}');
 saved := (result#>>'{contact,id}')::uuid;
 assert (select count(*) from public.reports)=before_report, 'Save contact created a report';
 assert (select contact_id=saved and report_id is null from public.str_calculator_leads where id=lead);
 assert (select to_jsonb(l)-'contact_id'=original from public.str_calculator_leads l where id=lead), 'Save changed submitted details';
 assert (public.get_agency_client(agency,saved)->'reportCounts')='{"draft":0,"published":0,"archived":0}', 'Saved contact should have zero reports';
 assert (public.get_agency_client(agency,saved)->>'leadsTotal')='1';
 assert (public.save_calculator_enquiry_contact(agency,actor,lead,'{}')#>>'{contact,id}')=saved::text, 'Save retry not idempotent';
 assert (select count(*) from public.agency_contacts)=before_count+1;
 select to_jsonb(c) into contact_snapshot from public.agency_contacts c where id=saved;

 -- New incoming enquiries link only consistent identities and never edit contacts.
 input := input || '{"full_name":" corrected  person ","email":" NEW-PERSON@EXAMPLE.TEST "}';
 matching_lead := (public.reserve_str_calculator_lead(token,gen_random_uuid(),'input2','device2',input,'v3','Consent')->>'id')::uuid;
 assert (select contact_id=saved from public.str_calculator_leads where id=matching_lead), 'Existing contact was not linked';
 assert (select to_jsonb(c)=contact_snapshot from public.agency_contacts c where id=saved), 'Public enquiry changed a saved contact';
 conflict_lead := (public.reserve_str_calculator_lead(token,gen_random_uuid(),'input3','device3',input || '{"full_name":"Different Person"}','v3','Consent')->>'id')::uuid;
 assert (select contact_id is null from public.str_calculator_leads where id=conflict_lead), 'Conflicting identity linked automatically';
 begin
   perform public.save_calculator_enquiry_contact(agency,actor,conflict_lead,'{"mode":"named","name":"Different Person","email":"new-person@example.test"}');
   raise exception 'Expected identity review';
 exception when sqlstate 'PT409' then null; end;
 perform public.save_calculator_enquiry_contact(agency,actor,conflict_lead,jsonb_build_object('mode','named','contact_id',saved,'name','Corrected Person'));
 assert (select contact_id=saved from public.str_calculator_leads where id=conflict_lead), 'Explicit selection did not link existing contact';

 -- The explicitly corrected contact carries through rather than resolving the old enquiry name again.
 report := (public.create_str_calculator_lead_report(agency,lead,actor,'classic-detailed',draft)->>'report_id')::uuid;
 assert (select contact_id=saved and recipient_name='Corrected Person' and not client_review_required from public.str_appraisals where report_id=report), 'Saved contact was not carried into the draft';
 assert public.contact_report_activity(agency,report)='draft';
 history := public.get_agency_client(agency,saved);
 assert history->'reportCounts'='{"draft":1,"published":0,"archived":0}';
 assert history->>'leadsTotal'='3', 'Multiple enquiries should remain with one contact';
 insert into public.digital_proposal_versions(id,report_id,agency_id,draft_revision,share_token,final_report_json)
 values('81000000-0000-4000-8000-000000000003',report,agency,1,repeat('e',64),'{"fixture":"frozen"}');
 insert into public.digital_proposal_links(agency_id,report_id,version_id,token)
 values(agency,report,'81000000-0000-4000-8000-000000000003',repeat('e',64));
 assert public.contact_report_activity(agency,report)='published', 'Active proposal not shown as published';
 assert (public.get_agency_client(agency,saved)->'reportCounts')='{"draft":0,"published":1,"archived":0}';
 select to_jsonb(r) into original from public.reports r where id=report;
 perform public.save_calculator_enquiry_contact(agency,actor,lead,'{"mode":"named","name":"Should not change"}');
 perform public.create_str_calculator_lead_report(agency,lead,actor,null,null);
 assert (select to_jsonb(r)=original from public.reports r where id=report), 'Save/retry changed a published report';
 assert (select final_report_json='{"fixture":"frozen"}' from public.digital_proposal_versions where id='81000000-0000-4000-8000-000000000003');
 update public.digital_proposal_links set revoked_at=now() where report_id=report;
 assert public.contact_report_activity(agency,report)='unpublished';
 update public.reports set status='archived' where id=report;
 assert public.contact_report_activity(agency,report)='archived';
 assert (public.get_agency_client(agency,saved)->'reportCounts')='{"draft":0,"published":0,"archived":1}';

 -- Archived people, missing names and different phones remain enquiries for review.
 update public.agency_contacts set archived_at=now() where id=saved;
 other := (public.reserve_str_calculator_lead(token,gen_random_uuid(),'input4','device4',input,'v3','Consent')->>'id')::uuid;
 assert (select contact_id is null from public.str_calculator_leads where id=other);
 update public.agency_contacts set archived_at=null where id=saved;
 other := (public.reserve_str_calculator_lead(token,gen_random_uuid(),'input5','device5',input-'full_name','v3','Consent')->>'id')::uuid;
 assert (select contact_id is null from public.str_calculator_leads where id=other);
 other := (public.reserve_str_calculator_lead(token,gen_random_uuid(),'input6','device6',input || '{"phone":"0400 000 999"}','v3','Consent')->>'id')::uuid;
 assert (select contact_id is null from public.str_calculator_leads where id=other);
 begin
   perform public.save_calculator_enquiry_contact(agency,'10000000-0000-4000-8000-000000000002',other,'{}');
   raise exception 'Accepted wrong actor';
 exception when insufficient_privilege then null; end;
 begin
   perform public.save_calculator_enquiry_contact('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',other,'{}');
   raise exception 'Accepted foreign enquiry';
 exception when sqlstate 'PT404' then null; end;
 -- Total counts must not be limited to the latest 50 displayed reports.
 for n in 1..51 loop
   perform public.create_appraisal(agency,'30000000-0000-4000-8000-000000000001',gen_random_uuid(),'lease','standard-lease-appraisal',
     jsonb_build_object('mode','named','contact_id',saved,'name','Corrected Person'),' {"version":1,"listing":{}}');
 end loop;
 history := public.get_agency_client(agency,saved);
 assert jsonb_array_length(history->'reports')=50;
 assert history->>'reportsTotal'='52';
 assert history->'reportCounts'='{"draft":51,"published":0,"archived":1}';
 assert not exists(select 1 from contact_history_baseline b join public.reports r using(id) where b.snapshot<>to_jsonb(r)), 'Existing report changed';
 assert not exists(select 1 from contact_versions_baseline b join public.digital_proposal_versions v using(id) where b.snapshot<>to_jsonb(v)), 'Existing published version changed';
end $$;
-- Exercise read routines as an actual agency member: column grants and RLS both apply.
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare page jsonb; begin
 page := public.list_calculator_enquiries('20000000-0000-4000-8000-000000000001',1,2);
 assert jsonb_array_length(page->'leads')=2;
 assert not ((page#>'{leads,0}') ? 'input_json'), 'Read routine exposed private input payload';
 assert (public.list_calculator_enquiries('20000000-0000-4000-8000-000000000002')->>'total')='0', 'Read leaked another agency';
 assert public.contact_report_activity('20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002') is null;
end $$;
rollback;
