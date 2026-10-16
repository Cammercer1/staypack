-- EMPTY disposable PostgreSQL only. Before shared-appraisal and client migrations.
-- The unrelated prospect routine only needs this composite type at creation time.
create table public.prospect_brands(id uuid,owner_user_id uuid,converted_agency_id uuid);
insert into public.agency_contacts(id,agency_id,name,email) values
  ('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Legacy One','legacy-duplicate@example.test'),
  ('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Legacy Two','LEGACY-DUPLICATE@example.test');
insert into public.digital_proposal_versions(id,report_id,agency_id,draft_revision,share_token,final_report_json)
  values('71000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,repeat('a',64),'{"fixture":"unchanged published snapshot"}');
create table public.client_qa_baseline as select
  (select jsonb_agg(to_jsonb(r) order by id) from public.reports r) as reports,
  (select jsonb_agg(to_jsonb(v) order by id) from public.digital_proposal_versions v) as versions,
  (select jsonb_agg(to_jsonb(c) order by id) from public.agency_contacts c) as clients;
grant select on public.client_qa_baseline to service_role;
