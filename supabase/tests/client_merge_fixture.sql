-- Disposable QA only: establish retained history before the merge migration.
insert into public.agency_contacts(id,agency_id,name,email,archived_at) values
 ('70000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','Legacy Three',' legacy-duplicate@example.test ',now());
set role service_role;
update public.str_appraisals set contact_id='70000000-0000-4000-8000-000000000002',recipient_mode='named',recipient_name='Original Report Recipient'
 where report_id='40000000-0000-4000-8000-000000000001';
update public.str_appraisals set contact_id='70000000-0000-4000-8000-000000000001',recipient_mode='named',recipient_name='Original Lease Recipient'
 where report_id='40000000-0000-4000-8000-000000000002';
insert into public.str_calculator_widgets(id,agency_id,enabled) values
 ('75000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',true);
insert into public.str_calculator_leads(id,agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,country,input_json,consent_version,consent_text,contact_id,report_id)
 values('76000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',gen_random_uuid(),'hash','client','24 Beach Road, Sydney NSW 2000',2,'legacy-duplicate@example.test','AU','{}','v3','Consent','70000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001');
reset role;
create table public.client_merge_qa_baseline as select
 (select jsonb_agg(to_jsonb(r) order by id) from public.reports r) as reports,
 (select jsonb_agg(to_jsonb(a) order by report_id) from public.str_appraisals a) as appraisals,
 (select jsonb_agg(to_jsonb(l) order by id) from public.str_calculator_leads l) as leads,
 (select jsonb_agg(to_jsonb(v) order by id) from public.digital_proposal_versions v) as versions,
 (select jsonb_agg(to_jsonb(l) order by id) from public.digital_proposal_links l) as links,
 (select jsonb_agg(to_jsonb(l) order by id) from public.listings l) as listings,
 (select jsonb_agg(to_jsonb(c) order by id) from public.agency_contacts c) as clients;
grant select on public.client_merge_qa_baseline to service_role;
